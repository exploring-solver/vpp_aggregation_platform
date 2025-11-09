from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from contextlib import asynccontextmanager
import asyncio
import logging
from datetime import datetime
import os

from simulator import TelemetrySimulator
from mqtt_client import MQTTClient
from config import settings

# Configure logging
logging.basicConfig(level=logging.DEBUG if os.getenv("DEBUG") else logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
simulator = TelemetrySimulator(settings.NODE_ID)
mqtt_client = None

def handle_control_command(command: dict):
    """Handle control commands from aggregator"""
    try:
        action = command.get('action')
        params = command.get('params', {})
        
        logger.info(f"Received control command: {action} with params {params}")
        
        # Apply control action to simulator
        simulator.apply_control(action, params)
        
    except Exception as e:
        logger.error(f"Error handling control command: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    global mqtt_client
    
    # Startup
    logger.info(f"Starting Edge Node {settings.NODE_ID} ({settings.NODE_NAME or 'Unnamed'})")
    
    # Initialize MQTT client - REQUIRED for telemetry transmission
    if settings.MQTT_ENABLED:
        try:
            mqtt_client = MQTTClient(
                broker_url=settings.MQTT_BROKER_URL,
                dc_id=settings.NODE_ID,
                on_control_callback=handle_control_command
            )
            await mqtt_client.connect()
            logger.info("MQTT client connected successfully")
        except Exception as e:
            logger.error(f"MQTT connection failed: {e}")
            logger.error("MQTT is required for telemetry transmission. Please check MQTT broker configuration.")
            raise  # Fail fast if MQTT connection fails
    else:
        logger.error("MQTT is disabled but required for telemetry transmission. Set MQTT_ENABLED=true")
        raise RuntimeError("MQTT_ENABLED must be true for telemetry transmission")
    
    # Start telemetry collection loop
    asyncio.create_task(telemetry_loop())
    logger.info("Telemetry loop started")
    
    # Log that we're using identifier-based M2M authentication
    logger.info(f"M2M authentication configured for node {settings.NODE_ID} using identifier key")
    
    yield
    
    # Shutdown
    if mqtt_client:
        mqtt_client.disconnect()
    logger.info("Edge node shutting down")

app = FastAPI(title="VPP Edge Node", version="1.0.0", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ControlCommand(BaseModel):
    action: str  # charge, discharge, defer_load, hold
    params: Optional[Dict[str, Any]] = {}

class TelemetryData(BaseModel):
    dc_id: str
    timestamp: str
    cpu_usage: float
    network_mb_sent: float
    network_mb_recv: float
    soc: float
    power_kw: float
    freq: float
    load_factor: float
    meta: Dict[str, Any] = {}

async def telemetry_loop():
    """Background task to collect and publish telemetry via MQTT only"""
    consecutive_failures = 0
    max_failures = 5
    
    while True:
        try:
            telemetry = simulator.generate_telemetry()
            logger.debug(f"Generated telemetry: {telemetry}")
            
            # Publish via MQTT - REQUIRED for telemetry transmission
            if mqtt_client and mqtt_client.connected:
                try:
                    await mqtt_client.publish_telemetry(telemetry)
                    consecutive_failures = 0  # Reset failure count on success
                    logger.debug(f"Telemetry published via MQTT for node {settings.NODE_ID}")
                except Exception as e:
                    consecutive_failures += 1
                    logger.error(f"MQTT publish failed ({consecutive_failures}/{max_failures}): {e}")
                    
                    if consecutive_failures >= max_failures:
                        logger.critical(f"MQTT publish failed {max_failures} times consecutively. Telemetry transmission stopped.")
                        # Continue loop but log error - don't crash the service
            else:
                logger.warning(f"MQTT client not connected. Skipping telemetry transmission for node {settings.NODE_ID}")
                consecutive_failures += 1
                
        except Exception as e:
            logger.error(f"Error in telemetry loop: {e}")
        
        await asyncio.sleep(settings.TELEMETRY_INTERVAL)

@app.get("/")
def read_root():
    return {
        "service": "VPP Edge Node",
        "node_id": settings.NODE_ID,
        "node_name": settings.NODE_NAME,
        "node_location": settings.NODE_LOCATION,
        "version": "1.0.0",
        # Legacy field for backward compatibility
        "dc_id": settings.NODE_ID
    }

@app.get("/status")
def get_status():
    """Get current node status snapshot"""
    telemetry = simulator.generate_telemetry()
    
    return {
        "node_id": settings.NODE_ID,
        "node_name": settings.NODE_NAME,
        "node_location": settings.NODE_LOCATION,
        "online": True,
        "telemetry": telemetry,
        "uptime_seconds": simulator.get_uptime(),
        "mqtt_enabled": settings.MQTT_ENABLED,
        "mqtt_connected": mqtt_client.connected if mqtt_client else False,
        # Legacy field for backward compatibility
        "dc_id": settings.NODE_ID
    }

@app.post("/control")
async def receive_control(command: ControlCommand):
    """Receive control commands via HTTP"""
    try:
        handle_control_command({
            "action": command.action,
            "params": command.params
        })
        
        return {
            "success": True,
            "message": f"Control command '{command.action}' applied",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error applying control: {e}")
        return {
            "success": False,
            "error": str(e)
        }

@app.post("/telemetry")
async def manual_telemetry(data: TelemetryData):
    """Manually push telemetry via MQTT (for testing)"""
    try:
        if mqtt_client and mqtt_client.connected:
            await mqtt_client.publish_telemetry(data.dict())
            return {"success": True, "message": "Telemetry sent via MQTT"}
        else:
            return {"success": False, "error": "MQTT client not connected"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
