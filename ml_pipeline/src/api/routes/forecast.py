from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field
from typing import List, Optional
import numpy as np
from datetime import datetime
from src.models.lstm_forecaster import LSTMForecaster
from src.data.data_pipeline import data_pipeline
from src.data.preprocessor import preprocessor
from src.utils.logger import logger

router = APIRouter(prefix="/forecast", tags=["Forecasting"])

class ForecastRequest(BaseModel):
    node_id: str = Field(..., description="Node identifier")
    lookback_hours: int = Field(24, description="Historical hours to use")
    forecast_horizon: int = Field(6, description="Hours to forecast")

class ForecastResponse(BaseModel):
    node_id: str
    timestamp: datetime
    predictions: List[float]
    confidence_intervals: Optional[List[dict]] = None
    metadata: dict

@router.post("/predict", response_model=ForecastResponse)
async def predict_power_output(request: ForecastRequest):
    """
    Predict future power output for a node
    """
    try:
        logger.info(f"Forecast request for node: {request.node_id}")
        
        # Fetch recent telemetry data
        df = await data_pipeline.fetch_telemetry_data(
            node_id=request.node_id,
            limit=request.lookback_hours * 4  # Assuming 15-min intervals
        )
        
        if df.empty or len(df) < request.lookback_hours:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient data for node {request.node_id}"
            )
        
        # Load model
        model = LSTMForecaster()
        try:
            model.load("latest")
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail=f"No trained model found for node {request.node_id}"
            )
        
        # Prepare input sequence
        feature_cols = ['powerOutput', 'voltage', 'current', 'frequency', 'temperature', 'efficiency']
        available_cols = [col for col in feature_cols if col in df.columns]
        
        df = df.sort_values('timestamp').tail(request.lookback_hours)
        features = df[available_cols].fillna(method='ffill').fillna(0).values
        
        # Ensure correct shape
        if len(features) < request.lookback_hours:
            # Pad with zeros if needed
            padding = np.zeros((request.lookback_hours - len(features), len(available_cols)))
            features = np.vstack([padding, features])
        
        X = features[-request.lookback_hours:].reshape(1, request.lookback_hours, len(available_cols))
        
        # Scale
        scaler_name = f"lstm_{request.node_id}"
        try:
            X_scaled = preprocessor.transform(X, scaler_name=scaler_name)
        except:
            X_scaled = preprocessor.fit_transform(X, scaler_name=scaler_name)
        
        # Predict
        predictions = model.predict(X_scaled)
        predictions_list = predictions[0].tolist()
        
        # Calculate confidence intervals (simple std-based)
        std = np.std(features[:, 0])  # powerOutput std
        confidence_intervals = [
            {
                'lower': max(0, pred - 1.96 * std),
                'upper': pred + 1.96 * std
            }
            for pred in predictions_list
        ]
        
        response = ForecastResponse(
            node_id=request.node_id,
            timestamp=datetime.now(),
            predictions=predictions_list,
            confidence_intervals=confidence_intervals,
            metadata={
                'lookback_hours': request.lookback_hours,
                'forecast_horizon': request.forecast_horizon,
                'model_version': 'latest'
            }
        )
        
        logger.info(f"Forecast generated for {request.node_id}: {predictions_list}")
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in forecast prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/health/{node_id}")
async def forecast_model_health(node_id: str):
    """Check if forecast model exists and is healthy"""
    try:
        model = LSTMForecaster()
        model.load("latest")
        
        return {
            "node_id": node_id,
            "model_status": "healthy",
            "model_loaded": True,
            "timestamp": datetime.now()
        }
    except FileNotFoundError:
        return {
            "node_id": node_id,
            "model_status": "not_found",
            "model_loaded": False,
            "timestamp": datetime.now()
        }
    except Exception as e:
        return {
            "node_id": node_id,
            "model_status": "error",
            "model_loaded": False,
            "error": str(e),
            "timestamp": datetime.now()
        }

@router.post("/batch-predict")
async def batch_predict(node_ids: List[str], lookback_hours: int = 24, forecast_horizon: int = 6):
    """Generate forecasts for multiple nodes"""
    results = []
    
    for node_id in node_ids:
        try:
            request = ForecastRequest(
                node_id=node_id,
                lookback_hours=lookback_hours,
                forecast_horizon=forecast_horizon
            )
            result = await predict_power_output(request)
            results.append({"node_id": node_id, "success": True, "data": result})
        except Exception as e:
            results.append({"node_id": node_id, "success": False, "error": str(e)})
    
    return {
        "total_nodes": len(node_ids),
        "successful": sum(1 for r in results if r["success"]),
        "results": results
    }