"""
Webhook endpoints for receiving data from Node.js backend
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from datetime import datetime
from services.data_ingestion_service import data_ingestion_service
from utils.logger import logger

router = APIRouter(prefix="/webhook", tags=["Webhooks"])

class TelemetryWebhook(BaseModel):
    """Telemetry data from Node.js"""
    nodeId: str
    timestamp: datetime
    powerOutput: float
    voltage: float
    current: float
    frequency: float
    batteryLevel: float
    data: Dict[str, Any] = {}

@router.post("/telemetry")
async def receive_telemetry(data: TelemetryWebhook):
    """
    Receive telemetry data from Node.js backend
    Node.js should POST to: http://ml-service:5000/webhook/telemetry
    """
    try:
        logger.info(f"📥 Webhook: Telemetry for {data.nodeId}")
        
        # Convert to dict and handle
        await data_ingestion_service.handle_webhook(data.dict())
        
        return {
            "status": "success",
            "message": "Telemetry received",
            "nodeId": data.nodeId,
            "timestamp": datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error in telemetry webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/forecast-request")
async def receive_forecast_request(request: Dict):
    """
    Receive forecast request from Node.js
    Node.js can request forecasts for specific nodes
    """
    try:
        node_id = request.get('nodeId')
        logger.info(f"📊 Forecast requested for {node_id}")
        
        # Trigger forecast generation (implement as needed)
        
        return {
            "status": "queued",
            "nodeId": node_id,
            "message": "Forecast generation queued"
        }
    
    except Exception as e:
        logger.error(f"Error in forecast webhook: {e}")
        raise HTTPException(status_code=500, detail=str(e))