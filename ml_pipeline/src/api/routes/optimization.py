from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
import numpy as np
from datetime import datetime
from src.models.rl_optimizer import RLOptimizer
from src.utils.logger import logger

router = APIRouter(prefix="/optimization", tags=["Optimization"])

class OptimizationRequest(BaseModel):
    current_state: Dict[str, float] = Field(..., description="Current system state")
    node_id: Optional[str] = None

class OptimizationResponse(BaseModel):
    recommended_action: str
    action_id: int
    expected_reward: float
    state: Dict[str, float]
    timestamp: datetime
    metadata: dict

class BatchOptimizationRequest(BaseModel):
    states: List[Dict[str, float]]

@router.post("/recommend", response_model=OptimizationResponse)
async def recommend_action(request: OptimizationRequest):
    """
    Get recommended bidding/dispatch action based on current state
    """
    try:
        logger.info(f"Optimization request: {request.current_state}")
        
        # Load RL model
        optimizer = RLOptimizer()
        try:
            optimizer.load("latest")
        except FileNotFoundError:
            raise HTTPException(
                status_code=404,
                detail="No trained RL model found"
            )
        
        # Convert state dict to array
        # Expected state: [SOC, grid_frequency, power_price, demand, hour, day_of_week]
        state_array = np.array([
            request.current_state.get('soc', 50.0),
            request.current_state.get('grid_frequency', 50.0),
            request.current_state.get('power_price', 100.0),
            request.current_state.get('demand', 500.0),
            request.current_state.get('hour', datetime.now().hour),
            request.current_state.get('day_of_week', datetime.now().weekday())
        ], dtype=np.float32)
        
        # Get action
        action_id, _ = optimizer.predict(state_array, deterministic=True)
        
        # Map action to readable format
        action_map = {
            0: "hold",
            1: "charge",
            2: "discharge",
            3: "bid_high",
            4: "bid_low"
        }
        
        recommended_action = action_map.get(action_id, "unknown")
        
        # Estimate expected reward (simplified)
        expected_reward = 0.0
        if recommended_action == "discharge":
            expected_reward = request.current_state.get('power_price', 100) * 0.25
        elif recommended_action == "charge":
            expected_reward = -request.current_state.get('power_price', 100) * 0.25 * 0.8
        
        response = OptimizationResponse(
            recommended_action=recommended_action,
            action_id=int(action_id),
            expected_reward=expected_reward,
            state=request.current_state,
            timestamp=datetime.now(),
            metadata={
                'model_version': 'latest',
                'algorithm': 'PPO'
            }
        )
        
        logger.info(f"Recommended action: {recommended_action} (reward: {expected_reward:.2f})")
        return response
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in optimization: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/batch-optimize")
async def batch_optimize(request: BatchOptimizationRequest):
    """Generate recommendations for multiple states"""
    results = []
    
    for idx, state in enumerate(request.states):
        try:
            opt_request = OptimizationRequest(current_state=state)
            result = await recommend_action(opt_request)
            results.append({"index": idx, "success": True, "data": result})
        except Exception as e:
            results.append({"index": idx, "success": False, "error": str(e)})
    
    return {
        "total_requests": len(request.states),
        "successful": sum(1 for r in results if r["success"]),
        "results": results
    }

@router.get("/strategy/current")
async def get_current_strategy():
    """Get current bidding strategy parameters"""
    return {
        "strategy": "rl_based",
        "algorithm": "PPO",
        "parameters": {
            "max_charge_rate": 250,
            "max_discharge_rate": 250,
            "target_soc_range": [30, 80],
            "frequency_support_enabled": True
        },
        "timestamp": datetime.now()
    }

@router.post("/evaluate-policy")
async def evaluate_policy(n_episodes: int = 10):
    """Evaluate current RL policy performance"""
    try:
        optimizer = RLOptimizer()
        optimizer.load("latest")
        
        # Create environment and evaluate
        optimizer.create_environment()
        metrics = optimizer.evaluate(n_episodes=n_episodes)
        
        return {
            "evaluation_metrics": metrics,
            "n_episodes": n_episodes,
            "timestamp": datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error evaluating policy: {e}")
        raise HTTPException(status_code=500, detail=str(e))