from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import psutil
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

app = FastAPI(title="VPP Edge Node", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global instances
simulator = TelemetrySimulator(settings.NODE_ID)
mqtt_client = None

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

@app.on_event("startup")
async def startup_event():
    global mqtt_client
    
    logger.info(f"Starting Edge Node {settings.NODE_ID} ({settings.NODE_NAME or 'Unnamed'})")
    
    # Initialize MQTT client if enabled
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
            logger.warning("Continuing without MQTT - edge node will use HTTP-only mode")
            mqtt_client = None
    
    # Start telemetry collection loop
    asyncio.create_task(telemetry_loop())
    logger.info("Telemetry loop started")
    
    # Log that we're using identifier-based M2M authentication
    logger.info(f"M2M authentication configured for node {settings.NODE_ID} using identifier key")

# -------------------------
# Identifier-based authentication for M2M
# -------------------------

def get_auth_headers():
    """Get authentication headers for API requests to aggregator."""
    return {
        "X-Node-ID": settings.NODE_ID,
        "X-Node-Key": settings.NODE_KEY
    }

@app.on_event("shutdown")
async def shutdown_event():
    if mqtt_client:
        mqtt_client.disconnect()
    logger.info("Edge node shutting down")

async def telemetry_loop():
    """Background task to collect and publish telemetry"""
    http_failure_count = 0
    max_http_failures = 5
    
    while True:
        try:
            telemetry = simulator.generate_telemetry()
            logger.debug(f"Generated telemetry: {telemetry}")
            
            # Publish via MQTT if enabled
            if mqtt_client and settings.MQTT_ENABLED:
                await mqtt_client.publish_telemetry(telemetry)
            
            # Also send via HTTP if aggregator URL is configured
            if settings.AGGREGATOR_URL and http_failure_count < max_http_failures:
                try:
                    await send_telemetry_http(telemetry)
                    http_failure_count = 0  # Reset on success
                except Exception as e:
                    http_failure_count += 1
                    if http_failure_count >= max_http_failures:
                        logger.warning(f"HTTP telemetry disabled after {max_http_failures} consecutive failures. Check aggregator at {settings.AGGREGATOR_URL}")
                    raise
                
        except Exception as e:
            logger.error(f"Error in telemetry loop: {e}")
        
        await asyncio.sleep(settings.TELEMETRY_INTERVAL)

async def send_telemetry_http(telemetry: dict):
    """Send telemetry to aggregator via HTTP with identifier-based authentication."""
    import httpx
    try:
        url = f"{settings.AGGREGATOR_URL}/api/telemetry"
        logger.debug(f"Sending HTTP telemetry to {url}")
        
        # Use identifier-based authentication headers
        headers = get_auth_headers()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=telemetry,
                headers=headers,
                timeout=10.0
            )
            if response.status_code == 201:
                logger.debug(f"HTTP telemetry sent successfully for node {settings.NODE_ID}")
            else:
                logger.warning(f"HTTP telemetry send failed: {response.status_code} - {response.text}")
    except httpx.ConnectError as e:
        logger.error(f"HTTP telemetry connection failed to {settings.AGGREGATOR_URL}: {e}")
    except httpx.TimeoutException as e:
        logger.error(f"HTTP telemetry timeout to {settings.AGGREGATOR_URL}: {e}")
    except Exception as e:
        logger.error(f"Error sending HTTP telemetry: {e}")
        logger.debug(f"Full exception:", exc_info=True)

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
    """Manually push telemetry (for testing)"""
    try:
        if mqtt_client and settings.MQTT_ENABLED:
            await mqtt_client.publish_telemetry(data.dict())
        
        if settings.AGGREGATOR_URL:
            await send_telemetry_http(data.dict())
        
        return {"success": True, "message": "Telemetry sent"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=settings.PORT)
