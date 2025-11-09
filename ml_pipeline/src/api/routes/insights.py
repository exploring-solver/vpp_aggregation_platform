from fastapi import APIRouter, HTTPException
from typing import Optional, List, Dict
from datetime import datetime, timedelta
from agents.intelligent_agent import intelligent_agent
from controllers.workload_orchestrator import workload_orchestrator
from config.db import db_manager
from utils.logger import logger

router = APIRouter(prefix="/insights", tags=["Insights & Analytics"])

@router.get("/daily-summary")
async def get_daily_summary():
    """
    Get AI-generated daily summary
    """
    try:
        # Fetch today's metrics
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        
        collection = db_manager.mongo_db['control_logs']
        logs = await collection.find({
            'timestamp': {'$gte': today_start}
        }).to_list(length=1000)
        
        # Calculate metrics
        total_revenue = sum(
            log.get('magnitude', 0) * 100  # Simplified revenue calc
            for log in logs if log.get('action') == 'discharge'
        )
        
        daily_metrics = {
            'date': datetime.now().date().isoformat(),
            'total_revenue': total_revenue,
            'control_actions': len(logs),
            'nodes_active': len(set(log.get('node_id') for log in logs))
        }
        
        # Generate AI summary
        summary = await intelligent_agent.generate_daily_report(daily_metrics)
        
        return {
            'metrics': daily_metrics,
            'ai_summary': summary,
            'timestamp': datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error generating daily summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/improvements")
async def get_improvement_suggestions(days: int = 7):
    """
    Get AI-generated improvement suggestions
    """
    try:
        # Fetch recent performance data
        start_date = datetime.now() - timedelta(days=days)
        
        collection = db_manager.mongo_db['control_logs']
        logs = await collection.find({
            'timestamp': {'$gte': start_date}
        }).to_list(length=1000)
        
        # Prepare performance data
        performance_data = {
            'period_days': days,
            'total_actions': len(logs),
            'action_breakdown': {}
        }
        
        for log in logs:
            action = log.get('action', 'unknown')
            performance_data['action_breakdown'][action] = \
                performance_data['action_breakdown'].get(action, 0) + 1
        
        # Get suggestions
        suggestions = await intelligent_agent.suggest_improvements(
            performance_data=performance_data,
            historical_decisions=logs[:10]
        )
        
        return {
            'period_days': days,
            'performance_summary': performance_data,
            'suggestions': suggestions,
            'timestamp': datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error getting improvements: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/patterns/{node_id}")
async def get_learned_patterns(node_id: str):
    """
    Get learned usage patterns for a node
    """
    try:
        # Ensure patterns are learned
        if node_id not in workload_orchestrator.learned_patterns:
            patterns = await workload_orchestrator.learn_usage_patterns(node_id)
        else:
            patterns = workload_orchestrator.learned_patterns[node_id]
        
        if not patterns:
            raise HTTPException(status_code=404, detail=f"No patterns learned for {node_id}")
        
        return {
            'node_id': node_id,
            'patterns': patterns,
            'timestamp': datetime.now()
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting patterns: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/anomaly/explain")
async def explain_anomaly(anomaly_data: Dict):
    """
    Get AI explanation for anomalous behavior
    """
    try:
        explanation = await intelligent_agent.explain_decision(
            decision={'anomaly_detected': True, **anomaly_data},
            context={'type': 'anomaly_analysis'}
        )
        
        return {
            'anomaly': anomaly_data,
            'explanation': explanation,
            'timestamp': datetime.now()
        }
    
    except Exception as e:
        logger.error(f"Error explaining anomaly: {e}")
        raise HTTPException(status_code=500, detail=str(e))