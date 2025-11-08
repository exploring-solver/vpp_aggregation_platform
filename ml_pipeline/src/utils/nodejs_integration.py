"""
Complete integration script for Node.js backend
Run this as a scheduled job (e.g., every 15 minutes)
"""
import asyncio
from datetime import datetime
from src.orchestrator.hybrid_orchestrator import hybrid_orchestrator
from src.utils.nodejs_integration import nodejs_client
from src.config.db import db_manager
from src.utils.logger import logger

async def run_complete_integration_cycle():
    """
    Complete integration cycle:
    1. Fetch nodes from Node.js
    2. Run orchestration
    3. Send results back to Node.js
    """
    try:
        logger.info("🔄 Starting integration cycle with Node.js backend")
        
        # Initialize
        await db_manager.connect_mongodb()
        await hybrid_orchestrator.initialize()
        
        # Get active nodes from Node.js
        # In production: nodes = await nodejs_client.fetch_active_nodes()
        nodes = ["node_001", "node_002", "node_003"]
        
        # Run orchestration
        results = await hybrid_orchestrator.orchestrate_complete_cycle(
            node_ids=nodes,
            execute_controls=True
        )
        
        # Send results to Node.js
        for node_id, node_result in results['nodes'].items():
            # Send forecasts
            if 'forecasts' in node_result:
                await nodejs_client.send_forecast(
                    node_id=node_id,
                    predictions=node_result['forecasts'].get('power', {}).get('forecast', []),
                    metadata={'source': 'hybrid_orchestrator'}
                )
            
            # Send optimization results
            if 'optimizations' in node_result:
                await nodejs_client.send_optimization_result(
                    node_id=node_id,
                    action=node_result['optimizations'].get('action', 'hold'),
                    expected_reward=node_result.get('revenue_potential', 0)
                )
            
            # Send workload suggestions
            if 'workload_suggestions' in node_result:
                # Store in Node.js database for dashboard display
                pass  # Implement as needed
        
        logger.info(
            f"✅ Integration cycle complete: "
            f"{len(nodes)} nodes, "
            f"₹{results['total_revenue_potential']:.2f} revenue potential"
        )
        
        return results
    
    except Exception as e:
        logger.error(f"❌ Integration cycle failed: {e}")
        raise
    finally:
        await db_manager.close()
        await nodejs_client.close()

if __name__ == "__main__":
    asyncio.run(run_complete_integration_cycle())