import asyncio
import numpy as np
from sklearn.model_selection import train_test_split
from datetime import datetime
from models.lstm_forecaster import LSTMForecaster
from data.data_pipeline import data_pipeline
from data.preprocessor import preprocessor
from config.db import db_manager
from utils.logger import logger
from registry.model_registry import model_registry
import mlflow
from config.config import config

async def train_lstm_model(
    node_id: str,
    lookback: int = 24,
    forecast_horizon: int = 6,
    epochs: int = 100,
    register_model: bool = True
) -> dict:
    """
    Train LSTM forecasting model for a specific node
    
    Args:
        node_id: Node identifier
        lookback: Historical timesteps
        forecast_horizon: Steps to forecast
        epochs: Training epochs
        register_model: Whether to register in MLflow
    
    Returns:
        Training results and metrics
    """
    try:
        logger.info(f"🚀 Starting LSTM training for node: {node_id}")
        
        # Initialize database
        await db_manager.connect_mongodb()
        
        # Fetch and prepare data
        logger.info("📊 Fetching training data...")
        X, y, metadata = await data_pipeline.prepare_lstm_dataset(
            node_id=node_id,
            lookback=lookback,
            forecast_horizon=forecast_horizon
        )
        
        if len(X) < config.MIN_TRAINING_SAMPLES:
            raise ValueError(f"Insufficient training samples: {len(X)} < {config.MIN_TRAINING_SAMPLES}")
        
        # Split data
        X_train, X_temp, y_train, y_temp = train_test_split(
            X, y, test_size=0.3, shuffle=False
        )
        X_val, X_test, y_val, y_test = train_test_split(
            X_temp, y_temp, test_size=0.5, shuffle=False
        )
        
        # Normalize data
        logger.info("🔄 Preprocessing data...")
        scaler_name = f"lstm_{node_id}"
        X_train_scaled = preprocessor.fit_transform(X_train, scaler_name=scaler_name)
        X_val_scaled = preprocessor.transform(X_val, scaler_name=scaler_name)
        X_test_scaled = preprocessor.transform(X_test, scaler_name=scaler_name)
        
        # Build and train model
        logger.info("🏗️ Building LSTM model...")
        model = LSTMForecaster(
            sequence_length=lookback,
            n_features=X.shape[2],
            forecast_horizon=forecast_horizon
        )
        model.build_model()
        
        # Start MLflow run
        if register_model:
            mlflow.set_tracking_uri(config.MLFLOW_TRACKING_URI)
            mlflow.set_experiment(config.MLFLOW_EXPERIMENT_NAME)
        
        with mlflow.start_run(run_name=f"lstm_{node_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"):
            # Log parameters
            if register_model:
                mlflow.log_params({
                    'node_id': node_id,
                    'lookback': lookback,
                    'forecast_horizon': forecast_horizon,
                    'n_features': X.shape[2],
                    'train_samples': len(X_train),
                    'val_samples': len(X_val),
                    'test_samples': len(X_test)
                })
            
            # Train
            logger.info("🎓 Training model...")
            training_results = model.train(
                X_train_scaled, y_train,
                X_val_scaled, y_val,
                epochs=epochs,
                batch_size=32,
                verbose=1
            )
            
            # Evaluate on test set
            logger.info("📈 Evaluating on test set...")
            test_metrics = model.evaluate(X_test_scaled, y_test)
            
            # Log metrics
            if register_model:
                mlflow.log_metrics({
                    **training_results,
                    **test_metrics
                })
            
            # Save model
            version = datetime.now().strftime('%Y%m%d_%H%M%S')
            model.save(version=version)
            
            # Register model
            if register_model:
                await model_registry.register_model(
                    model_type='lstm',
                    node_id=node_id,
                    version=version,
                    metrics=test_metrics,
                    metadata={
                        'lookback': lookback,
                        'forecast_horizon': forecast_horizon,
                        'n_features': X.shape[2],
                        **metadata
                    }
                )
            
            results = {
                'node_id': node_id,
                'version': version,
                'training': training_results,
                'test': test_metrics,
                'metadata': metadata
            }
            
            logger.info(f"✅ LSTM training completed successfully for {node_id}")
            logger.info(f"Test RMSE: {test_metrics['test_rmse']:.4f}")
            
            return results
    
    except Exception as e:
        logger.error(f"❌ Error in LSTM training: {e}")
        raise
    finally:
        await db_manager.close()

def train_lstm_sync(node_id: str, **kwargs):
    """Synchronous wrapper for async training"""
    return asyncio.run(train_lstm_model(node_id, **kwargs))

if __name__ == "__main__":
    # Example usage
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python train_lstm.py <node_id>")
        sys.exit(1)
    
    node_id = sys.argv[1]
    asyncio.run(train_lstm_model(node_id))