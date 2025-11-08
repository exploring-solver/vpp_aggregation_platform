"""
Complete integration script for Node.js backend
Orchestrates ML pipeline and communicates with Node.js

Usage:
    # Run once
    python integration_nodejs.py --once
    
    # Run continuously (every 15 minutes)
    python integration_nodejs.py --continuous
    
    # Specific node
    python integration_nodejs.py --node DC0001
    
    # Advisory mode (don't execute)
    python integration_nodejs.py --mode advisory
"""
import asyncio
import argparse
from datetime import datetime, timedelta
from typing import List, Dict, Optional
import sys

# Import all components
from src.orchestrator.hybrid_orchestrator import hybrid_orchestrator
from src.controllers.power_flow_controller import power_controller
from src.models.foundation_forecaster import foundation_forecaster
from src.agents.intelligent_agent import intelligent_agent
from src.config.db import db_manager
from src.config.config import config
from src.utils.logger import logger

class NodeJSIntegration:
    """
    Integration manager for Node.js backend communication
    Handles orchestration, data sync, and command execution
    """
    
    def __init__(self, control_mode: str = "advisory"):
        self.control_mode = control_mode  # 'autonomous' or 'advisory'
        self.last_run = {}  # node_id -> last_run_time
        self.run_interval = timedelta(minutes=15)
        
    async def initialize(self):
        """Initialize all components"""
        try:
            logger.info("🚀 Initializing Node.js Integration...")
            
            # Connect databases
            await db_manager.connect_mongodb()
            logger.info("✅ MongoDB connected")
            
            # Initialize orchestrator
            await hybrid_orchestrator.initialize()
            hybrid_orchestrator.control_mode = self.control_mode
            logger.info(f"✅ Orchestrator initialized (mode: {self.control_mode})")
            
        except Exception as e:
            logger.error(f"❌ Initialization failed: {e}")
            raise
    
    async def get_active_nodes_from_db(self) -> List[str]:
        """
        Get list of active nodes from MongoDB
        In production, this would query Node.js backend
        """
        try:
            collection = db_manager.mongo_db['metadatas']
            
            # Find all active nodes
            cursor = collection.find({
                'operational.isActive': True
            })
            
            metadatas = await cursor.to_list(length=1000)
            node_ids = [m['nodeId'] for m in metadatas]
            
            logger.info(f"📊 Found {len(node_ids)} active nodes")
            return node_ids
        
        except Exception as e:
            logger.error(f"Error getting active nodes: {e}")
            return []
    
    async def should_run_orchestration(self, node_id: str) -> bool:
        """Check if enough time has passed since last run"""
        if node_id not in self.last_run:
            return True
        
        time_since_last = datetime.now() - self.last_run[node_id]
        return time_since_last >= self.run_interval
    
    async def run_single_orchestration(
        self,
        node_id: str,
        execute_controls: bool = True
    ) -> Dict:
        """
        Run complete orchestration for a single node
        
        Args:
            node_id: Node identifier
            execute_controls: Whether to actually execute commands
        
        Returns:
            Orchestration results
        """
        try:
            logger.info(f"\n{'='*80}")
            logger.info(f"🎯 Starting orchestration for {node_id}")
            logger.info(f"{'='*80}")
            
            # Check if should run
            if not await self.should_run_orchestration(node_id):
                logger.info(f"⏭️  Skipping {node_id} (ran recently)")
                return {'status': 'skipped', 'reason': 'interval_not_reached'}
            
            # Run orchestration
            results = await hybrid_orchestrator.orchestrate_complete_cycle(
                node_ids=[node_id],
                execute_controls=execute_controls and self.control_mode == 'autonomous'
            )
            
            # Update last run time
            self.last_run[node_id] = datetime.now()
            
            # Process results
            node_result = results['nodes'].get(node_id, {})
            
            # Send results to Node.js (if available)
            await self._send_results_to_nodejs(node_id, node_result)
            
            # Log summary
            self._log_summary(node_id, node_result)
            
            return {
                'status': 'success',
                'node_id': node_id,
                'results': node_result,
                'timestamp': datetime.now()
            }
        
        except Exception as e:
            logger.error(f"❌ Error orchestrating {node_id}: {e}")
            return {
                'status': 'error',
                'node_id': node_id,
                'error': str(e)
            }
    
    async def run_batch_orchestration(
        self,
        node_ids: Optional[List[str]] = None,
        execute_controls: bool = True
    ) -> Dict:
        """
        Run orchestration for multiple nodes
        
        Args:
            node_ids: List of node IDs (None = all active)
            execute_controls: Whether to execute commands
        
        Returns:
            Batch results
        """
        try:
            # Get nodes if not provided
            if node_ids is None:
                node_ids = await self.get_active_nodes_from_db()
            
            if not node_ids:
                logger.warning("No active nodes found")
                return {'status': 'no_nodes'}
            
            logger.info(f"\n{'='*80}")
            logger.info(f"🚀 Starting batch orchestration for {len(node_ids)} nodes")
            logger.info(f"{'='*80}")
            
            # Filter nodes that need orchestration
            nodes_to_run = [
                nid for nid in node_ids
                if await self.should_run_orchestration(nid)
            ]
            
            if not nodes_to_run:
                logger.info("⏭️  All nodes ran recently, skipping batch")
                return {'status': 'skipped', 'reason': 'all_recent'}
            
            logger.info(f"🎯 Orchestrating {len(nodes_to_run)} nodes")
            
            # Run orchestration
            results = await hybrid_orchestrator.orchestrate_complete_cycle(
                node_ids=nodes_to_run,
                execute_controls=execute_controls and self.control_mode == 'autonomous'
            )
            
            # Update last run times
            for node_id in nodes_to_run:
                self.last_run[node_id] = datetime.now()
            
            # Send results to Node.js
            for node_id, node_result in results['nodes'].items():
                await self._send_results_to_nodejs(node_id, node_result)
            
            # Log batch summary
            self._log_batch_summary(results)
            
            return {
                'status': 'success',
                'nodes_processed': len(nodes_to_run),
                'total_revenue_potential': results.get('total_revenue_potential', 0),
                'total_cost_savings': results.get('total_cost_savings', 0),
                'results': results
            }
        
        except Exception as e:
            logger.error(f"❌ Error in batch orchestration: {e}")
            return {'status': 'error', 'error': str(e)}
    
    async def _send_results_to_nodejs(self, node_id: str, results: Dict):
        """
        Send orchestration results to Node.js backend
        """
        try:
            import aiohttp
            
            # Prepare payload
            payload = {
                'nodeId': node_id,
                'timestamp': datetime.now().isoformat(),
                'forecasts': results.get('forecasts', {}),
                'optimization': results.get('optimizations', {}),
                'revenue_potential': results.get('revenue_potential', 0),
                'cost_savings': results.get('cost_savings', 0),
                'explanation': results.get('explanation', ''),
                'strategic_decision': results.get('strategic_decision', {})
            }
            
            # Send to Node.js
            url = f"{config.NODEJS_BACKEND_URL}/api/ml/results"
            
            async with aiohttp.ClientSession() as session:
                try:
                    async with session.post(url, json=payload, timeout=5) as response:
                        if response.status == 200:
                            logger.info(f"✅ Results sent to Node.js for {node_id}")
                        else:
                            logger.warning(f"⚠️  Node.js returned status {response.status}")
                except aiohttp.ClientConnectorError:
                    logger.debug(f"Node.js backend not available at {url}")
        
        except Exception as e:
            logger.debug(f"Could not send results to Node.js: {e}")
    
    def _log_summary(self, node_id: str, results: Dict):
        """Log summary for single node"""
        logger.info(f"\n📊 Summary for {node_id}:")
        logger.info(f"   Revenue Potential: ₹{results.get('revenue_potential', 0):.2f}")
        logger.info(f"   Cost Savings: ₹{results.get('cost_savings', 0):.2f}")
        
        if 'optimizations' in results:
            opt = results['optimizations']
            logger.info(f"   Recommended Action: {opt.get('action', 'None')}")
            logger.info(f"   Magnitude: {opt.get('magnitude', 0)}")
        
        if 'explanation' in results:
            logger.info(f"   Explanation: {results['explanation'][:100]}...")
    
    def _log_batch_summary(self, results: Dict):
        """Log summary for batch orchestration"""
        logger.info(f"\n{'='*80}")
        logger.info(f"📊 BATCH ORCHESTRATION SUMMARY")
        logger.info(f"{'='*80}")
        logger.info(f"Total Nodes: {len(results['nodes'])}")
        logger.info(f"Total Revenue Potential: ₹{results['total_revenue_potential']:.2f}")
        logger.info(f"Total Cost Savings: ₹{results['total_cost_savings']:.2f}")
        logger.info(f"Execution Time: {results['execution_time_seconds']:.2f}s")
        
        # Per-node breakdown
        logger.info(f"\nPer-Node Breakdown:")
        for node_id, node_result in results['nodes'].items():
            revenue = node_result.get('revenue_potential', 0)
            savings = node_result.get('cost_savings', 0)
            action = node_result.get('optimizations', {}).get('action', 'None')
            logger.info(f"  {node_id}: ₹{revenue:.2f} revenue, ₹{savings:.2f} savings, Action: {action}")
    
    async def run_continuous(self, interval_minutes: int = 15):
        """
        Run orchestration continuously with specified interval
        
        Args:
            interval_minutes: Minutes between orchestration cycles
        """
        logger.info(f"🔄 Starting continuous mode (every {interval_minutes} minutes)")
        
        while True:
            try:
                # Run batch orchestration
                await self.run_batch_orchestration(execute_controls=True)
                
                # Wait for next cycle
                logger.info(f"\n⏰ Waiting {interval_minutes} minutes until next cycle...")
                await asyncio.sleep(interval_minutes * 60)
            
            except KeyboardInterrupt:
                logger.info("\n⏹️  Stopped by user")
                break
            except Exception as e:
                logger.error(f"Error in continuous loop: {e}")
                await asyncio.sleep(60)  # Wait 1 minute on error
    
    async def shutdown(self):
        """Cleanup and shutdown"""
        try:
            logger.info("🔌 Shutting down integration...")
            await db_manager.close()
            logger.info("✅ Shutdown complete")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

# ============================================================================
# CLI Interface
# ============================================================================

async def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description='Node.js Integration for VPP ML Pipeline'
    )
    
    parser.add_argument(
        '--mode',
        choices=['autonomous', 'advisory'],
        default='advisory',
        help='Control mode (autonomous=execute commands, advisory=recommendations only)'
    )
    
    parser.add_argument(
        '--node',
        type=str,
        help='Specific node ID to orchestrate'
    )
    
    parser.add_argument(
        '--continuous',
        action='store_true',
        help='Run continuously (every 15 minutes)'
    )
    
    parser.add_argument(
        '--once',
        action='store_true',
        help='Run once and exit'
    )
    
    parser.add_argument(
        '--interval',
        type=int,
        default=15,
        help='Interval in minutes for continuous mode (default: 15)'
    )
    
    parser.add_argument(
        '--no-execute',
        action='store_true',
        help='Do not execute commands (advisory mode)'
    )
    
    args = parser.parse_args()
    
    # Determine control mode
    if args.no_execute:
        control_mode = 'advisory'
    else:
        control_mode = args.mode
    
    # Create integration manager
    integration = NodeJSIntegration(control_mode=control_mode)
    
    try:
        # Initialize
        await integration.initialize()
        
        # Run based on arguments
        if args.continuous:
            # Continuous mode
            await integration.run_continuous(interval_minutes=args.interval)
        
        elif args.node:
            # Single node
            result = await integration.run_single_orchestration(
                node_id=args.node,
                execute_controls=not args.no_execute
            )
            
            if result['status'] == 'success':
                logger.info("\n✅ Orchestration completed successfully")
                return 0
            else:
                logger.error(f"\n❌ Orchestration failed: {result.get('error')}")
                return 1
        
        else:
            # Batch (once)
            result = await integration.run_batch_orchestration(
                execute_controls=not args.no_execute
            )
            
            if result['status'] == 'success':
                logger.info("\n✅ Batch orchestration completed successfully")
                return 0
            else:
                logger.error(f"\n❌ Batch orchestration failed")
                return 1
    
    except KeyboardInterrupt:
        logger.info("\n⏹️  Interrupted by user")
        return 0
    
    except Exception as e:
        logger.error(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    finally:
        await integration.shutdown()

# ============================================================================
# Direct Usage Examples
# ============================================================================

async def example_single_node():
    """Example: Orchestrate single node"""
    integration = NodeJSIntegration(control_mode='advisory')
    
    try:
        await integration.initialize()
        result = await integration.run_single_orchestration('DC0001')
        print(f"Result: {result}")
    finally:
        await integration.shutdown()

async def example_batch():
    """Example: Orchestrate all nodes"""
    integration = NodeJSIntegration(control_mode='autonomous')
    
    try:
        await integration.initialize()
        result = await integration.run_batch_orchestration()
        print(f"Processed {result.get('nodes_processed')} nodes")
    finally:
        await integration.shutdown()

async def example_specific_nodes():
    """Example: Orchestrate specific nodes"""
    integration = NodeJSIntegration(control_mode='advisory')
    
    try:
        await integration.initialize()
        result = await integration.run_batch_orchestration(
            node_ids=['DC0001', 'DC0002', 'DC0003']
        )
        print(f"Revenue: ₹{result.get('total_revenue_potential', 0):.2f}")
    finally:
        await integration.shutdown()

# ============================================================================
# Entry Point
# ============================================================================

if __name__ == "__main__":
    sys.exit(asyncio.run(main()))