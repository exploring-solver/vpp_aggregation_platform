import asyncio
from datetime import datetime
from models.rl_optimizer import RLOptimizer
from data.data_pipeline import data_pipeline
from config.db import db_manager
from utils.logger import logger
from registry.model_registry import model_registry
import mlflow
from config.config import config

async def train_rl_model(
    algorithm: str = "PPO",
    total_timesteps: int = 100000,
    register_model: bool = True
) -> dict:
    """
    Train RL optimization model
    
    Args:
        algorithm: RL algorithm ('PPO' or 'DQN')
        total_timesteps: Total training timesteps
        register_model: Whether to register in MLflow
    
    Returns:
        Training results and metrics
    """
    try:
        logger.info(f"🚀 Starting RL training with {algorithm}")
        
        # Initialize database
        await db_manager.connect_mongodb()
        
        # Fetch historical data for environment initialization
        logger.info("📊 Fetching historical data...")
        env_data = await data_pipeline.prepare_rl_environment_data(lookback_days=30)
        
        # Create RL optimizer
        logger.info("🏗️ Building RL model...")
        optimizer = RLOptimizer(algorithm=algorithm)
        optimizer.create_environment(historical_data=env_data)
        optimizer.build_model()
        
        # Start MLflow run
        if register_model:
            mlflow.set_tracking_uri(config.MLFLOW_TRACKING_URI)
            mlflow.set_experiment(config.MLFLOW_EXPERIMENT_NAME)
        
        with mlflow.start_run(run_name=f"rl_{algorithm}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
            # Log parameters
            if register_model:
                mlflow.log_params({
                    'algorithm': algorithm,
                    'total_timesteps': total_timesteps,
                    'env_type': 'GridBiddingEnv'
                })
            
            # Train
            logger.info("🎓 Training RL model...")
            training_results = optimizer.train(
                total_timesteps=total_timesteps,
                eval_freq=5000,
                n_eval_episodes=10
            )
            
            # Evaluate
            logger.info("📈 Evaluating model...")
            eval_metrics = optimizer.evaluate(n_episodes=20)
            
            # Log metrics
            if register_model:
                mlflow.log_metrics(eval_metrics)
            
            # Save model
            version = datetime.now().strftime('%Y%m%d_%H%M%S')
            optimizer.save(version=version)
            
            # Register model
            if register_model:
                await model_registry.register_model(
                    model_type='rl',
                    node_id='global',
                    version=version,
                    metrics=eval_metrics,
                    metadata={
                        'algorithm': algorithm,
                        'total_timesteps': total_timesteps
                    }
                )
            
            results = {
                'algorithm': algorithm,
                'version': version,
                'training': training_results,
                'evaluation': eval_metrics
            }
            
            logger.info(f"✅ RL training completed successfully")
            logger.info(f"Mean reward: {eval_metrics['mean_reward']:.2f}")
            
            return results
    
    except Exception as e:
        logger.error(f"❌ Error in RL training: {e}")
        raise
    finally:
        await db_manager.close()

def train_rl_sync(algorithm: str = "PPO", **kwargs):
    """Synchronous wrapper for async training"""
    return asyncio.run(train_rl_model(algorithm, **kwargs))

if __name__ == "__main__":
    import sys
    
    algorithm = sys.argv[1] if len(sys.argv) > 1 else "PPO"
    asyncio.run(train_rl_model(algorithm))