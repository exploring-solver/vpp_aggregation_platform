from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from datetime import datetime
from src.training.train_lstm import train_lstm_model
from src.training.train_rl import train_rl_model
from src.registry.drift_monitor import drift_monitor
from src.utils.logger import logger
from src.config.config import config

class TrainingScheduler:
    """Automated training scheduler"""
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.active_nodes = []
    
    async def check_and_retrain_lstm(self):
        """Check for drift and retrain LSTM models if needed"""
        try:
            logger.info("🔍 Checking for model drift...")
            
            # Get active nodes (you can fetch from metadata)
            # For now, using a placeholder
            nodes_to_check = self.active_nodes or ["node_001"]
            
            for node_id in nodes_to_check:
                needs_retraining = await drift_monitor.check_drift(
                    model_type='lstm',
                    node_id=node_id
                )
                
                if needs_retraining:
                    logger.info(f"🔄 Retraining LSTM for {node_id} due to drift")
                    await train_lstm_model(
                        node_id=node_id,
                        epochs=50,  # Fewer epochs for retraining
                        register_model=True
                    )
                else:
                    logger.info(f"✅ No drift detected for {node_id}")
        
        except Exception as e:
            logger.error(f"Error in drift check: {e}")
    
    async def scheduled_rl_training(self):
        """Periodic RL model retraining"""
        try:
            logger.info("🔄 Starting scheduled RL retraining...")
            await train_rl_model(
                algorithm="PPO",
                total_timesteps=50000,
                register_model=True
            )
        except Exception as e:
            logger.error(f"Error in scheduled RL training: {e}")
    
    def start(self):
        """Start the scheduler"""
        # Schedule LSTM drift check and retraining
        self.scheduler.add_job(
            self.check_and_retrain_lstm,
            CronTrigger(hour=config.RETRAIN_INTERVAL_HOURS),
            id='lstm_drift_check',
            name='LSTM Drift Check and Retrain',
            replace_existing=True
        )
        
        # Schedule RL retraining (weekly)
        self.scheduler.add_job(
            self.scheduled_rl_training,
            CronTrigger(day_of_week='sun', hour=2),
            id='rl_retrain',
            name='RL Weekly Retrain',
            replace_existing=True
        )
        
        self.scheduler.start()
        logger.info("✅ Training scheduler started")
    
    def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("⏹️ Training scheduler stopped")
    
    def update_active_nodes(self, node_ids: list):
        """Update list of active nodes to monitor"""
        self.active_nodes = node_ids
        logger.info(f"Updated active nodes: {len(node_ids)} nodes")

# Global scheduler instance
training_scheduler = TrainingScheduler()