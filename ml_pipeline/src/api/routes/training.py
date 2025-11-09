from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from training.train_lstm import train_lstm_model
from training.train_rl import train_rl_model
from registry.model_registry import model_registry
from registry.drift_monitor import drift_monitor
from utils.logger import logger

router = APIRouter(prefix="/training", tags=["Training"])

class TrainLSTMRequest(BaseModel):
    node_id: str
    epochs: int = Field(100, ge=1, le=500)
    lookback: int = Field(24, ge=6, le=168)
    forecast_horizon: int = Field(6, ge=1, le=24)

class TrainRLRequest(BaseModel):
    algorithm: str = Field("PPO", pattern="^(PPO|DQN)$")
    total_timesteps: int = Field(100000, ge=1000, le=1000000)

class TrainingResponse(BaseModel):
    status: str
    message: str
    job_id: Optional[str] = None
    timestamp: datetime

@router.post("/lstm/train", response_model=TrainingResponse)
async def train_lstm(request: TrainLSTMRequest, background_tasks: BackgroundTasks):
    """
    Trigger LSTM model training for a specific node
    """
    try:
        logger.info(f"Received LSTM training request for node: {request.node_id}")
        
        # Add training job to background tasks
        job_id = f"lstm_{request.node_id}_{int(datetime.now().timestamp())}"
        
        background_tasks.add_task(
            train_lstm_model,
            node_id=request.node_id,
            lookback=request.lookback,
            forecast_horizon=request.forecast_horizon,
            epochs=request.epochs,
            register_model=True
        )
        
        return TrainingResponse(
            status="accepted",
            message=f"LSTM training job queued for node {request.node_id}",
            job_id=job_id,
            timestamp=datetime.now()
        )
    
    except Exception as e:
        logger.error(f"Error queuing LSTM training: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/rl/train", response_model=TrainingResponse)
async def train_rl(request: TrainRLRequest, background_tasks: BackgroundTasks):
    """
    Trigger RL model training
    """
    try:
        logger.info(f"Received RL training request: {request.algorithm}")
        
        job_id = f"rl_{request.algorithm}_{int(datetime.now().timestamp())}"
        
        background_tasks.add_task(
            train_rl_model,
            algorithm=request.algorithm,
            total_timesteps=request.total_timesteps,
            register_model=True
        )
        
        return TrainingResponse(
            status="accepted",
            message=f"RL training job queued with {request.algorithm}",
            job_id=job_id,
            timestamp=datetime.now()
        )
    
    except Exception as e:
        logger.error(f"Error queuing RL training: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/list")
async def list_models(
    model_type: Optional[str] = None,
    node_id: Optional[str] = None,
    limit: int = 50
):
    """List all registered models"""
    try:
        models = await model_registry.list_models(
            model_type=model_type,
            node_id=node_id,
            limit=limit
        )
        
        # Convert ObjectId to string
        for model in models:
            if '_id' in model:
                model['_id'] = str(model['_id'])
        
        return {
            "total": len(models),
            "models": models
        }
    
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models/{model_type}/{node_id}/active")
async def get_active_model(model_type: str, node_id: str):
    """Get currently active model for a node"""
    try:
        model = await model_registry.get_active_model(model_type, node_id)
        
        if not model:
            raise HTTPException(
                status_code=404,
                detail=f"No active model found for {model_type}/{node_id}"
            )
        
        if '_id' in model:
            model['_id'] = str(model['_id'])
        
        return model
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting active model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/drift/{model_type}/{node_id}")
async def check_model_drift(model_type: str, node_id: str):
    """Check if model has drifted and needs retraining"""
    try:
        needs_retraining = await drift_monitor.check_drift(
            model_type=model_type,
            node_id=node_id,
            lookback_days=7
        )
        
        # Get drift history
        history = await drift_monitor.get_drift_history(
            model_type=model_type,
            node_id=node_id,
            limit=10
        )
        
        # Convert ObjectId to string
        for record in history:
            if '_id' in record:
                record['_id'] = str(record['_id'])
        
        return {
            "model_type": model_type,
            "node_id": node_id,
            "needs_retraining": needs_retraining,
            "drift_history": history,
            "timestamp": datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error checking drift: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/retrain-all-drifted")
async def retrain_all_drifted(background_tasks: BackgroundTasks):
    """Check all models for drift and retrain if needed"""
    try:
        # Get all active models
        lstm_models = await model_registry.list_models(model_type="lstm", limit=100)
        
        retrain_jobs = []
        
        for model in lstm_models:
            node_id = model.get('node_id')
            if not node_id:
                continue
            
            needs_retraining = await drift_monitor.check_drift(
                model_type='lstm',
                node_id=node_id
            )
            
            if needs_retraining:
                job_id = f"lstm_{node_id}_{int(datetime.now().timestamp())}"
                background_tasks.add_task(
                    train_lstm_model,
                    node_id=node_id,
                    epochs=50,
                    register_model=True
                )
                retrain_jobs.append({"node_id": node_id, "job_id": job_id})
        
        return {
            "status": "accepted",
            "models_checked": len(lstm_models),
            "retraining_jobs": len(retrain_jobs),
            "jobs": retrain_jobs,
            "timestamp": datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error in bulk retraining: {e}")
        raise HTTPException(status_code=500, detail=str(e))