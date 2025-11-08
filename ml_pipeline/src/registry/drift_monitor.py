import numpy as np
from typing import Dict, Optional
from datetime import datetime, timedelta
from src.config.db import db_manager
from src.data.data_pipeline import data_pipeline
from src.models.lstm_forecaster import LSTMForecaster
from src.data.preprocessor import preprocessor
from src.utils.logger import logger
from src.config.config import config

class DriftMonitor:
    """Monitor model performance drift"""
    
    def __init__(self):
        self.drift_threshold = config.DRIFT_THRESHOLD
        self.collection_name = "drift_metrics"
    
    async def check_drift(
        self,
        model_type: str,
        node_id: str,
        lookback_days: int = 7
    ) -> bool:
        """
        Check if model performance has drifted
        
        Returns:
            True if retraining is needed
        """
        try:
            # Get current model performance
            current_metrics = await self._calculate_current_performance(
                model_type, node_id, lookback_days
            )
            
            # Get baseline metrics
            baseline_metrics = await self._get_baseline_metrics(model_type, node_id)
            
            if not baseline_metrics:
                logger.warning(f"No baseline metrics found for {node_id}")
                return False
            
            # Calculate drift
            drift_score = self._calculate_drift_score(current_metrics, baseline_metrics)
            
            # Store drift metrics
            await self._store_drift_metrics(
                model_type, node_id, current_metrics, drift_score
            )
            
            logger.info(f"Drift score for {node_id}: {drift_score:.4f}")
            
            # Determine if retraining is needed
            needs_retraining = drift_score > self.drift_threshold
            
            return needs_retraining
        
        except Exception as e:
            logger.error(f"Error checking drift: {e}")
            return False
    
    async def _calculate_current_performance(
        self,
        model_type: str,
        node_id: str,
        lookback_days: int
    ) -> Dict:
        """Calculate current model performance on recent data"""
        try:
            if model_type != 'lstm':
                return {}
            
            # Fetch recent data
            end_date = datetime.now()
            start_date = end_date - timedelta(days=lookback_days)
            
            df = await data_pipeline.fetch_telemetry_data(
                node_id=node_id,
                start_date=start_date,
                end_date=end_date
            )
            
            if df.empty or len(df) < 48:  # Need at least 48 hours
                return {}
            
            # Load model
            model = LSTMForecaster()
            try:
                model.load("latest")
            except:
                return {}
            
            # Prepare test data
            X, y, _ = await data_pipeline.prepare_lstm_dataset(node_id, lookback=24, forecast_horizon=6)
            
            if len(X) < 10:
                return {}
            
            # Take last 20% as test
            test_size = max(10, len(X) // 5)
            X_test = X[-test_size:]
            y_test = y[-test_size:]
            
            # Transform
            scaler_name = f"lstm_{node_id}"
            try:
                X_test_scaled = preprocessor.transform(X_test, scaler_name=scaler_name)
            except:
                X_test_scaled = preprocessor.fit_transform(X_test, scaler_name=scaler_name)
            
            # Evaluate
            metrics = model.evaluate(X_test_scaled, y_test)
            
            return metrics
        
        except Exception as e:
            logger.error(f"Error calculating current performance: {e}")
            return {}
    
    async def _get_baseline_metrics(self, model_type: str, node_id: str) -> Optional[Dict]:
        """Get baseline metrics from model registry"""
        try:
            from src.registry.model_registry import model_registry
            
            model_info = await model_registry.get_active_model(model_type, node_id)
            
            if model_info and 'metrics' in model_info:
                return model_info['metrics']
            
            return None
        
        except Exception as e:
            logger.error(f"Error getting baseline metrics: {e}")
            return None
    
    def _calculate_drift_score(
        self,
        current_metrics: Dict,
        baseline_metrics: Dict
    ) -> float:
        """
        Calculate drift score based on metric degradation
        
        Returns:
            Drift score (0-1, higher = more drift)
        """
        if not current_metrics or not baseline_metrics:
            return 0.0
        
        # Use RMSE as primary metric
        baseline_rmse = baseline_metrics.get('test_rmse', baseline_metrics.get('val_rmse', 0))
        current_rmse = current_metrics.get('test_rmse', current_metrics.get('val_rmse', 0))
        
        if baseline_rmse == 0:
            return 0.0
        
        # Calculate relative increase in error
        drift_score = (current_rmse - baseline_rmse) / baseline_rmse
        
        # Clamp to [0, 1]
        drift_score = max(0, min(1, drift_score))
        
        return drift_score
    
    async def _store_drift_metrics(
        self,
        model_type: str,
        node_id: str,
        metrics: Dict,
        drift_score: float
    ):
        """Store drift monitoring metrics"""
        try:
            collection = db_manager.mongo_db[self.collection_name]
            
            doc = {
                'model_type': model_type,
                'node_id': node_id,
                'metrics': metrics,
                'drift_score': drift_score,
                'checked_at': datetime.now()
            }
            
            await collection.insert_one(doc)
        
        except Exception as e:
            logger.error(f"Error storing drift metrics: {e}")
    
    async def get_drift_history(
        self,
        model_type: str,
        node_id: str,
        limit: int = 30
    ) -> list:
        """Get drift history"""
        try:
            collection = db_manager.mongo_db[self.collection_name]
            
            cursor = collection.find(
                {
                    'model_type': model_type,
                    'node_id': node_id
                }
            ).sort('checked_at', -1).limit(limit)
            
            history = await cursor.to_list(length=limit)
            return history
        
        except Exception as e:
            logger.error(f"Error fetching drift history: {e}")
            return []

# Global monitor instance
drift_monitor = DriftMonitor()