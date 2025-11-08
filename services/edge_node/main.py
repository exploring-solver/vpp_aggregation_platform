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
simulator = TelemetrySimulator(settings.DC_ID)
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
    
    logger.info(f"Starting Edge Node {settings.DC_ID}")
    
    # Initialize MQTT client if enabled
    if settings.MQTT_ENABLED:
        try:
            mqtt_client = MQTTClient(
                broker_url=settings.MQTT_BROKER_URL,
                dc_id=settings.DC_ID,
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

# -------------------------
# Auth0 M2M token management
# -------------------------
import time
_token_cache = {"access_token": None, "expires_at": 0}

async def get_m2m_token():
    """Obtain and cache a client_credentials token for posting to aggregator."""
    import httpx, os
    now = int(time.time())
    # Return cached token if valid with 30s buffer
    if _token_cache["access_token"] and _token_cache["expires_at"] - 30 > now:
        return _token_cache["access_token"]

    domain = os.getenv("AUTH0_DOMAIN")
    audience = os.getenv("AUTH0_AUDIENCE")
    client_id = os.getenv("AUTH0_CLIENT_ID")
    client_secret = os.getenv("AUTH0_CLIENT_SECRET")

    if not all([domain, audience, client_id, client_secret]):
        raise RuntimeError("Auth0 env vars missing on edge node (AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET)")

    token_url = f"https://{domain}/oauth/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "audience": audience,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(token_url, json=payload)
        r.raise_for_status()
        data = r.json()
        _token_cache["access_token"] = data["access_token"]
        _token_cache["expires_at"] = now + int(data.get("expires_in", 3600))
        return _token_cache["access_token"]

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
    """Send telemetry to aggregator via HTTP with Bearer token."""
    import httpx
    try:
        url = f"{settings.AGGREGATOR_URL}/api/telemetry"
        logger.debug(f"Sending HTTP telemetry to {url}")
        # Obtain M2M token (cached)
        token = await get_m2m_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                json=telemetry,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0
            )
            if response.status_code == 201:
                logger.debug(f"HTTP telemetry sent successfully")
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
        "dc_id": settings.DC_ID,
        "version": "1.0.0"
    }

@app.get("/status")
def get_status():
    """Get current node status snapshot"""
    telemetry = simulator.generate_telemetry()
    
    return {
        "dc_id": settings.DC_ID,
        "online": True,
        "telemetry": telemetry,
        "uptime_seconds": simulator.get_uptime(),
        "mqtt_enabled": settings.MQTT_ENABLED,
        "mqtt_connected": mqtt_client.connected if mqtt_client else False
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
