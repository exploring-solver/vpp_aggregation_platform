from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Literal
from datetime import datetime
from orchestrator.hybrid_orchestrator import hybrid_orchestrator
from controllers.power_flow_controller import power_controller
from controllers.workload_orchestrator import workload_orchestrator
from utils.logger import logger

router = APIRouter(prefix="/control", tags=["Intelligent Control"])

class PowerControlRequest(BaseModel):
    node_id: str
    action: Literal["Charge", "Discharge", "Hold", "Load Deferral"] = Field(
        ..., 
        description="Control action to execute"
    )
    magnitude: float = Field(
        ..., 
        ge=0, 
        le=250,
        description="kW for Charge/Discharge, % for Load Deferral"
    )
    reason: str = Field(..., description="Reason for this action")
    duration_minutes: int = Field(15, ge=1, le=120, description="Duration in minutes")
    
    @validator('magnitude')
    def validate_magnitude(cls, v, values):
        """Validate magnitude based on action type"""
        action = values.get('action')
        if action == 'Load Deferral' and v > 100:
            raise ValueError("Load Deferral magnitude must be 0-100%")
        return v

class PowerControlBatchRequest(BaseModel):
    commands: List[PowerControlRequest]

@router.post("/power/execute")
async def execute_power_control(request: PowerControlRequest):
    """
    Execute specific power control command to a node
    
    Commands:
    - Charge: Charge battery at specified kW
    - Discharge: Discharge battery at specified kW
    - Hold: Maintain current state
    - Load Deferral: Defer workload by specified %
    """
    try:
        logger.info(f"🎯 Executing control: {request.action} on {request.node_id}")
        
        result = await power_controller.control_node_power(
            node_id=request.node_id,
            action=request.action,
            magnitude=request.magnitude,
            reason=request.reason,
            duration_minutes=request.duration_minutes
        )
        
        if result['status'] == 'success':
            logger.info(f"✅ Control executed: {request.action} ({request.magnitude})")
        else:
            logger.warning(f"⚠️ Control rejected: {result.get('reason')}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error executing power control: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/power/batch")
async def execute_batch_controls(request: PowerControlBatchRequest):
    """
    Execute multiple control commands in batch
    """
    results = []
    
    for cmd in request.commands:
        try:
            result = await power_controller.control_node_power(
                node_id=cmd.node_id,
                action=cmd.action,
                magnitude=cmd.magnitude,
                reason=cmd.reason,
                duration_minutes=cmd.duration_minutes
            )
            results.append({
                'node_id': cmd.node_id,
                'status': result['status'],
                'result': result
            })
        except Exception as e:
            results.append({
                'node_id': cmd.node_id,
                'status': 'error',
                'error': str(e)
            })
    
    successful = sum(1 for r in results if r['status'] == 'success')
    
    return {
        'total_commands': len(request.commands),
        'successful': successful,
        'failed': len(request.commands) - successful,
        'results': results,
        'timestamp': datetime.now()
    }

@router.get("/commands/available")
async def get_available_commands():
    """
    Get list of available control commands
    """
    return {
        'commands': power_controller.valid_commands,
        'descriptions': {
            'Charge': 'Charge battery at specified kW rate',
            'Discharge': 'Discharge battery at specified kW rate',
            'Hold': 'Maintain current operating state',
            'Load Deferral': 'Defer data center workload by specified percentage'
        },
        'magnitude_units': {
            'Charge': 'kW (0-250)',
            'Discharge': 'kW (0-250)',
            'Hold': 'N/A (use 0)',
            'Load Deferral': '% (0-100)'
        },
        'safety_limits': power_controller.safety_limits
    }

@router.post("/test-command/{node_id}")
async def test_command(
    node_id: str,
    action: Literal["Charge", "Discharge", "Hold", "Load Deferral"] = "Hold"
):
    """
    Test command format without executing
    """
    command = {
        'nodeId': node_id,
        'command': action,
        'value': 0,
        'duration': 1,
        'reason': 'Test command',
        'timestamp': datetime.now().isoformat()
    }
    
    return {
        'test_mode': True,
        'formatted_command': command,
        'note': 'This command was not executed. Use /power/execute for actual execution.'
    }