"""
Campus Controller Service
Aggregates multiple BESS units at a single physical location
Provides campus-level optimization and redundancy management
"""

import asyncio
import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import httpx

import sys
sys.path.append('..')
from models.location_schema import (
    Campus, Building, Node, NodeStatus, NodeCapacity,
    CampusTelemetry, GeoLocation
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Environment configuration
CAMPUS_ID = os.getenv("CAMPUS_ID", "CAMPUS_MUMBAI_ANDHERI")
AGGREGATOR_URL = os.getenv("AGGREGATOR_URL", "http://localhost:3000")
LAYER3_URL = os.getenv("LAYER3_URL", "http://layer3_regional:8000")  # Layer 3 regional aggregator
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "10"))  # seconds

# FastAPI app
app = FastAPI(title="Campus Controller", version="1.0.0")


# Request models
class PowerDispatch(BaseModel):
    """Power dispatch command for campus"""
    total_power_kw: float
    strategy: str = "proportional"  # 'proportional', 'priority', 'balanced'
    node_setpoints: Optional[Dict[str, float]] = None  # Manual per-node setpoints


class OptimizationRequest(BaseModel):
    """Campus-level optimization request"""
    objective: str  # 'minimize_losses', 'balance_soc', 'maximize_availability'
    constraints: Dict[str, Any] = {}


# Campus Controller class
class CampusController:
    """Campus-level BESS aggregator and optimizer"""

    def __init__(self, campus_config: Campus):
        self.campus = campus_config
        self.nodes: Dict[str, Node] = {}  # node_id -> Node
        self.node_telemetry: Dict[str, Dict] = {}  # node_id -> latest telemetry
        self.is_running = False

    async def start(self):
        """Start campus controller"""
        logger.info(f"Starting Campus Controller: {self.campus.campus_id}")

        # Discover and register nodes
        await self.discover_nodes()

        # Register with Layer 3 (regional aggregator)
        await self.register_with_layer3()

        self.is_running = True
        logger.info(f"Campus Controller started: {len(self.nodes)} nodes")

    async def stop(self):
        """Stop campus controller"""
        logger.info("Stopping Campus Controller")
        self.is_running = False

    async def discover_nodes(self):
        """Discover all BESS nodes in this campus"""
        # In production, this would query a database or configuration
        # For now, we'll check for nodes that registered with the aggregator

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{AGGREGATOR_URL}/api/nodes",
                    params={"campus_id": self.campus.campus_id},
                    timeout=10.0
                )

                if response.status_code == 200:
                    nodes_data = response.json()

                    for node_data in nodes_data.get('nodes', []):
                        node = Node(**node_data)
                        self.nodes[node.node_id] = node
                        logger.info(f"Discovered node: {node.node_id}")

                else:
                    logger.warning(f"Failed to discover nodes: {response.status_code}")

        except Exception as e:
            logger.error(f"Error discovering nodes: {e}")

    async def register_with_layer3(self):
        """Register this campus with Layer 3 regional aggregator"""
        try:
            capacity = self.get_aggregate_capacity()

            payload = {
                "campus_id": self.campus.campus_id,
                "name": self.campus.name,
                "location": {
                    "latitude": self.campus.geo_location.latitude,
                    "longitude": self.campus.geo_location.longitude
                },
                "capacity_kwh": capacity.energy_capacity_kwh,
                "max_power_kw": capacity.rated_power_kw,
                "num_nodes": len(self.nodes)
            }

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{LAYER3_URL}/api/campus/register",
                    json=payload,
                    timeout=10.0
                )

                if response.status_code == 200:
                    logger.info(f"Registered with Layer 3: {self.campus.campus_id}")
                else:
                    logger.warning(f"Failed to register with Layer 3: {response.status_code}")

        except Exception as e:
            logger.error(f"Error registering with Layer 3: {e}")

    async def poll_node_telemetry(self):
        """Poll telemetry from all nodes"""
        for node_id, node in self.nodes.items():
            try:
                if not node.endpoint_url:
                    continue

                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        f"{node.endpoint_url}/telemetry",
                        timeout=5.0
                    )

                    if response.status_code == 200:
                        telemetry = response.json()
                        self.node_telemetry[node_id] = telemetry

                        # Update node status
                        node.status = NodeStatus.ONLINE
                        node.last_seen = datetime.utcnow()
                        node.soc = telemetry.get('soc')
                        node.soh = telemetry.get('soh')
                        node.power_kw = telemetry.get('power_kw')
                        node.temperature = telemetry.get('temperature')

                    else:
                        logger.warning(f"Failed to poll {node_id}: {response.status_code}")
                        node.status = NodeStatus.OFFLINE

            except Exception as e:
                logger.error(f"Error polling {node_id}: {e}")
                node.status = NodeStatus.OFFLINE

    def get_aggregate_capacity(self) -> NodeCapacity:
        """Calculate aggregate capacity of all campus nodes"""
        total_power = 0.0
        total_energy = 0.0
        available_power = 0.0
        available_energy = 0.0

        for node in self.nodes.values():
            total_power += node.capacity.rated_power_kw
            total_energy += node.capacity.energy_capacity_kwh

            if node.status == NodeStatus.ONLINE:
                available_power += node.capacity.available_power_kw
                available_energy += node.capacity.available_energy_kwh

        return NodeCapacity(
            rated_power_kw=total_power,
            energy_capacity_kwh=total_energy,
            available_power_kw=available_power,
            available_energy_kwh=available_energy
        )

    def get_campus_telemetry(self) -> CampusTelemetry:
        """Generate aggregated campus telemetry"""
        online_nodes = [n for n in self.nodes.values() if n.status == NodeStatus.ONLINE]
        fault_nodes = [n for n in self.nodes.values() if n.status == NodeStatus.FAULT]

        # Calculate aggregates
        total_power = sum(n.power_kw for n in online_nodes if n.power_kw is not None)
        socs = [n.soc for n in online_nodes if n.soc is not None]
        sohs = [n.soh for n in online_nodes if n.soh is not None]

        avg_soc = sum(socs) / len(socs) if socs else 0.0
        avg_soh = sum(sohs) / len(sohs) if sohs else 100.0
        min_soc = min(socs) if socs else 0.0
        max_soc = max(socs) if socs else 0.0

        capacity = self.get_aggregate_capacity()

        return CampusTelemetry(
            campus_id=self.campus.campus_id,
            timestamp=datetime.utcnow(),
            total_power_kw=total_power,
            total_capacity_kwh=capacity.energy_capacity_kwh,
            average_soc=avg_soc,
            average_soh=avg_soh,
            total_nodes=len(self.nodes),
            online_nodes=len(online_nodes),
            fault_nodes=len(fault_nodes),
            min_soc=min_soc,
            max_soc=max_soc,
            total_energy_available_kwh=capacity.available_energy_kwh
        )

    async def dispatch_power(self, dispatch: PowerDispatch) -> Dict[str, float]:
        """
        Dispatch power across campus nodes

        Args:
            dispatch: Power dispatch command

        Returns:
            Dictionary of node_id -> power_kw setpoints
        """
        online_nodes = [n for n in self.nodes.values() if n.status == NodeStatus.ONLINE]

        if not online_nodes:
            raise ValueError("No online nodes available")

        # Calculate per-node setpoints based on strategy
        if dispatch.node_setpoints:
            # Manual setpoints provided
            setpoints = dispatch.node_setpoints
        elif dispatch.strategy == "proportional":
            # Distribute proportionally to capacity
            setpoints = self._proportional_dispatch(dispatch.total_power_kw, online_nodes)
        elif dispatch.strategy == "balanced":
            # Balance SOC across nodes
            setpoints = self._balanced_dispatch(dispatch.total_power_kw, online_nodes)
        elif dispatch.strategy == "priority":
            # Priority-based dispatch (highest SOC first for discharge)
            setpoints = self._priority_dispatch(dispatch.total_power_kw, online_nodes)
        else:
            raise ValueError(f"Unknown dispatch strategy: {dispatch.strategy}")

        # Send setpoints to nodes
        results = {}
        for node_id, power_kw in setpoints.items():
            try:
                node = self.nodes[node_id]
                if not node.endpoint_url:
                    continue

                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        f"{node.endpoint_url}/power",
                        json={"power_kw": power_kw, "reactive_power_kvar": 0.0},
                        timeout=5.0
                    )

                    if response.status_code == 200:
                        results[node_id] = power_kw
                        logger.info(f"Dispatched {power_kw:.2f} kW to {node_id}")
                    else:
                        logger.error(f"Failed to dispatch to {node_id}: {response.status_code}")

            except Exception as e:
                logger.error(f"Error dispatching to {node_id}: {e}")

        return results

    def _proportional_dispatch(self, total_power_kw: float, nodes: List[Node]) -> Dict[str, float]:
        """Distribute power proportionally to node capacity"""
        total_capacity = sum(n.capacity.rated_power_kw for n in nodes)

        setpoints = {}
        for node in nodes:
            proportion = node.capacity.rated_power_kw / total_capacity
            setpoints[node.node_id] = total_power_kw * proportion

        return setpoints

    def _balanced_dispatch(self, total_power_kw: float, nodes: List[Node]) -> Dict[str, float]:
        """Balance SOC across nodes"""
        # Get current SOCs
        socs = {n.node_id: n.soc or 50.0 for n in nodes}
        avg_soc = sum(socs.values()) / len(socs)

        # Calculate SOC deviations
        deviations = {node_id: soc - avg_soc for node_id, soc in socs.items()}

        # If discharging, discharge more from higher SOC nodes
        # If charging, charge more to lower SOC nodes
        total_deviation = sum(abs(d) for d in deviations.values())

        setpoints = {}
        for node in nodes:
            if total_deviation == 0:
                # All equal, distribute evenly
                proportion = 1.0 / len(nodes)
            else:
                deviation = deviations[node.node_id]
                if total_power_kw < 0:  # Discharging
                    # Discharge more from higher SOC
                    proportion = (deviation / total_deviation) if deviation > 0 else 0.0
                else:  # Charging
                    # Charge more to lower SOC
                    proportion = (-deviation / total_deviation) if deviation < 0 else 0.0

            setpoints[node.node_id] = total_power_kw * proportion

        return setpoints

    def _priority_dispatch(self, total_power_kw: float, nodes: List[Node]) -> Dict[str, float]:
        """Priority-based dispatch (sorted by SOC)"""
        # Sort nodes by SOC
        if total_power_kw < 0:  # Discharging
            # Discharge from highest SOC first
            sorted_nodes = sorted(nodes, key=lambda n: n.soc or 0.0, reverse=True)
        else:  # Charging
            # Charge lowest SOC first
            sorted_nodes = sorted(nodes, key=lambda n: n.soc or 100.0)

        setpoints = {}
        remaining_power = total_power_kw

        for node in sorted_nodes:
            # Allocate up to node's capacity
            max_node_power = node.capacity.rated_power_kw
            allocated = min(abs(remaining_power), max_node_power)
            allocated = allocated if total_power_kw >= 0 else -allocated

            setpoints[node.node_id] = allocated
            remaining_power -= allocated

            if abs(remaining_power) < 0.1:
                break

        # Fill remaining nodes with zero
        for node in sorted_nodes:
            if node.node_id not in setpoints:
                setpoints[node.node_id] = 0.0

        return setpoints


# Global controller instance
# In production, this would be loaded from configuration
campus_config = Campus(
    campus_id=CAMPUS_ID,
    name="Mumbai Andheri Campus",
    city_id="CITY_MUMBAI",
    state_id="STATE_MAHARASHTRA",
    country_id="COUNTRY_INDIA",
    geo_location=GeoLocation(latitude=19.1136, longitude=72.8697),
    address="Andheri East, Mumbai, Maharashtra 400069",
    timezone="Asia/Kolkata"
)

controller = CampusController(campus_config)


# Background polling task
async def polling_loop():
    """Poll node telemetry periodically"""
    while controller.is_running:
        try:
            await controller.poll_node_telemetry()
        except Exception as e:
            logger.error(f"Error in polling loop: {e}")

        await asyncio.sleep(POLL_INTERVAL)


# FastAPI routes
@app.on_event("startup")
async def startup():
    """Start controller and background tasks"""
    await controller.start()
    asyncio.create_task(polling_loop())


@app.on_event("shutdown")
async def shutdown():
    """Stop controller"""
    await controller.stop()


@app.get("/health")
async def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "campus_id": controller.campus.campus_id,
        "num_nodes": len(controller.nodes),
        "online_nodes": sum(1 for n in controller.nodes.values() if n.status == NodeStatus.ONLINE)
    }


@app.get("/telemetry")
async def get_telemetry():
    """Get aggregated campus telemetry"""
    telemetry = controller.get_campus_telemetry()
    return telemetry.dict()


@app.get("/nodes")
async def get_nodes():
    """Get all campus nodes"""
    return {
        "campus_id": controller.campus.campus_id,
        "nodes": [node.dict() for node in controller.nodes.values()]
    }


@app.get("/nodes/{node_id}")
async def get_node(node_id: str):
    """Get specific node details"""
    if node_id not in controller.nodes:
        raise HTTPException(status_code=404, detail="Node not found")

    node = controller.nodes[node_id]
    telemetry = controller.node_telemetry.get(node_id)

    return {
        "node": node.dict(),
        "telemetry": telemetry
    }


@app.post("/dispatch")
async def dispatch_power(dispatch: PowerDispatch):
    """Dispatch power across campus nodes"""
    try:
        setpoints = await controller.dispatch_power(dispatch)
        return {
            "status": "success",
            "total_power_kw": dispatch.total_power_kw,
            "strategy": dispatch.strategy,
            "setpoints": setpoints
        }
    except Exception as e:
        logger.error(f"Dispatch error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/capacity")
async def get_capacity():
    """Get aggregate campus capacity"""
    capacity = controller.get_aggregate_capacity()
    return capacity.dict()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8100)
