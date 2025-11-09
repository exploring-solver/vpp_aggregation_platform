"""
Foundation forecaster using Prophet for time series prediction
Prophet is easy to install and provides excellent results for power forecasting
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
from utils.logger import logger
import os
import contextlib
from config.config import config
import asyncio
import warnings
warnings.filterwarnings('ignore')

# Try to import Prophet
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
    logger.info("✅ Prophet library available")
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("⚠️  Prophet not available - using statistical fallback")

class FoundationForecaster:
    """
    Time series forecaster using Facebook Prophet
    - Easy to install and use
    - Handles seasonality automatically
    - Works from Day 1 with zero-shot capability
    - Gets better with more data
    """
    
    def __init__(self):
        self.prophet_available = PROPHET_AVAILABLE
        self.trained_models = {}  # node_id -> trained Prophet model
        self.model_stats = {}     # node_id -> statistics
        self.pipeline = None
        
        if PROPHET_AVAILABLE:
            logger.info("🔮 Using Prophet for forecasting")
        else:
            logger.info("📊 Using statistical fallback for forecasting")
    
    def predict_zero_shot(
        self,
        historical_data: np.ndarray,
        prediction_length: int = 6,
        timestamps: Optional[pd.DatetimeIndex] = None
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Make predictions with minimum 48 hours context"""
        try:
            # Require minimum context
            if len(historical_data) < 48:
                logger.warning(f"Insufficient data ({len(historical_data)} < 48), using fallback")
                return self._fallback_prediction(historical_data, prediction_length)
            
            # Use last 168 hours (1 week) for best results
            context_data = historical_data[-168:] if len(historical_data) >= 168 else historical_data
            
            if self.prophet_available:
                return self._predict_with_prophet(
                    context_data, 
                    prediction_length,
                    timestamps[-len(context_data):] if timestamps is not None else None
                )
            else:
                return self._fallback_prediction(context_data, prediction_length)
        
        except Exception as e:
            logger.error(f"Error in zero-shot prediction: {e}")
            return self._fallback_prediction(historical_data, prediction_length)
    
    def _predict_with_prophet(
        self,
        historical_data: np.ndarray,
        prediction_length: int,
        timestamps: Optional[pd.DatetimeIndex] = None
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Use Prophet for prediction"""
        try:
            # Prepare data for Prophet
            if timestamps is None:
                end_time = datetime.now()
                timestamps = pd.date_range(
                    end=end_time,
                    periods=len(historical_data),
                    freq='H'
                )
            
            # Create DataFrame in Prophet format
            df = pd.DataFrame({
                'ds': timestamps,
                'y': historical_data
            })
            
            # Configure Prophet with cmdstan backend (Prophet 1.1+)
            import logging
            logging.getLogger('prophet').setLevel(logging.WARNING)
            logging.getLogger('cmdstanpy').setLevel(logging.WARNING)
            
            model = Prophet(
                seasonality_mode='multiplicative',
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=False,
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10,
                interval_width=0.95
            )
            
            # Fit model with suppressed output
            with open(os.devnull, 'w') as devnull:
                import contextlib
                with contextlib.redirect_stdout(devnull), contextlib.redirect_stderr(devnull):
                    model.fit(df)
            
            # Create future dataframe
            future = model.make_future_dataframe(periods=prediction_length, freq='H')
            
            # Make prediction
            forecast = model.predict(future)
            
            # Extract predictions
            predictions = forecast['yhat'].values[-prediction_length:]
            lower_bound = forecast['yhat_lower'].values[-prediction_length:]
            upper_bound = forecast['yhat_upper'].values[-prediction_length:]
            
            # Ensure non-negative
            predictions = np.maximum(predictions, 0)
            lower_bound = np.maximum(lower_bound, 0)
            upper_bound = np.maximum(upper_bound, 0)
            
            logger.info(f"Prophet forecast: {predictions[:3].tolist()}...")
            return predictions, lower_bound, upper_bound
        
        except Exception as e:
            logger.error(f"Prophet prediction failed: {e}")
            logger.info("Falling back to statistical forecasting")
            return self._fallback_prediction(historical_data, prediction_length)
    
    def _fallback_prediction(
        self,
        historical_data: np.ndarray,
        prediction_length: int
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Statistical fallback using exponential smoothing + seasonality
        """
        try:
            if len(historical_data) < 2:
                last_val = historical_data[-1] if len(historical_data) > 0 else 100.0
                predictions = np.full(prediction_length, last_val)
                std = 10.0
                return predictions, predictions - std, predictions + std
            
            # Triple exponential smoothing (Holt-Winters)
            from statsmodels.tsa.holtwinters import ExponentialSmoothing
            
            try:
                # Try exponential smoothing
                if len(historical_data) >= 24:
                    model = ExponentialSmoothing(
                        historical_data,
                        seasonal_periods=24,
                        trend='add',
                        seasonal='add'
                    )
                    fitted_model = model.fit()
                    predictions = fitted_model.forecast(steps=prediction_length)
                else:
                    # Simple exponential smoothing
                    model = ExponentialSmoothing(historical_data, trend='add')
                    fitted_model = model.fit()
                    predictions = fitted_model.forecast(steps=prediction_length)
                
                predictions = np.array(predictions)
                
            except:
                # If statsmodels fails, use simple method
                alpha = 0.3
                beta = 0.1
                level = historical_data[0]
                trend = 0
                
                for value in historical_data[1:]:
                    last_level = level
                    level = alpha * value + (1 - alpha) * (level + trend)
                    trend = beta * (level - last_level) + (1 - beta) * trend
                
                predictions = np.array([
                    level + i * trend
                    for i in range(1, prediction_length + 1)
                ])
            
            # Calculate confidence intervals
            recent_data = historical_data[-min(48, len(historical_data)):]
            std = np.std(recent_data)
            
            lower_bound = predictions - 1.96 * std
            upper_bound = predictions + 1.96 * std
            
            # Ensure non-negative
            predictions = np.maximum(predictions, 0)
            lower_bound = np.maximum(lower_bound, 0)
            upper_bound = np.maximum(upper_bound, 0)
            
            logger.info(f"Fallback forecast: {predictions[:3].tolist()}...")
            return predictions, lower_bound, upper_bound
        
        except Exception as e:
            logger.error(f"Fallback prediction error: {e}")
            # Last resort
            last_val = historical_data[-1] if len(historical_data) > 0 else 100.0
            predictions = np.full(prediction_length, last_val)
            return predictions, predictions * 0.9, predictions * 1.1
    
    async def fine_tune(
        self,
        node_id: str,
        training_data: np.ndarray,
        timestamps: Optional[pd.DatetimeIndex] = None,
        validation_split: float = 0.2
    ) -> Dict:
        """
        Fine-tune Prophet model on node-specific data
        Model gets better with 7+ days of data
        
        Args:
            node_id: Node identifier
            training_data: Historical power values
            timestamps: Timestamps for the data
            validation_split: Validation split ratio
        
        Returns:
            Training results
        """
        try:
            logger.info(f"Fine-tuning Prophet model for {node_id} with {len(training_data)} samples")
            
            if not self.prophet_available:
                # Store statistics for fallback
                return await self._fine_tune_fallback(node_id, training_data)
            
            # Generate timestamps if not provided
            if timestamps is None:
                end_time = datetime.now()
                timestamps = pd.date_range(
                    end=end_time,
                    periods=len(training_data),
                    freq='H'
                )
            
            # Prepare data
            df = pd.DataFrame({
                'ds': timestamps,
                'y': training_data
            })
            
            # Split train/validation
            split_idx = int(len(df) * (1 - validation_split))
            train_df = df[:split_idx]
            val_df = df[split_idx:]
            
            # Train Prophet model
            model = Prophet(
                seasonality_mode='multiplicative',
                daily_seasonality=True,
                weekly_seasonality=True,
                yearly_seasonality=len(training_data) >= 365 * 24,  # Only if 1+ year data
                changepoint_prior_scale=0.05,
                seasonality_prior_scale=10,
                interval_width=0.95
            )
            
            # Add custom seasonality for data center workloads
            if len(training_data) >= 24:
                model.add_seasonality(
                    name='hourly',
                    period=24,
                    fourier_order=8
                )
            
            # Fit model
            import logging
            logging.getLogger('prophet').setLevel(logging.WARNING)
            model.fit(train_df)
            
            # Validate
            val_forecast = model.predict(val_df[['ds']])
            val_mae = np.mean(np.abs(val_forecast['yhat'].values - val_df['y'].values))
            val_mape = np.mean(np.abs((val_forecast['yhat'].values - val_df['y'].values) / val_df['y'].values)) * 100
            
            # Store model
            self.trained_models[node_id] = {
                'model': model,
                'trained_at': datetime.now(),
                'training_samples': len(train_df),
                'validation_mae': float(val_mae),
                'validation_mape': float(val_mape)
            }
            
            logger.info(f"✅ Prophet model trained for {node_id}")
            logger.info(f"   Validation MAE: {val_mae:.2f}, MAPE: {val_mape:.2f}%")
            
            return {
                "status": "success",
                "node_id": node_id,
                "method": "prophet",
                "training_samples": len(train_df),
                "validation_mae": float(val_mae),
                "validation_mape": float(val_mape),
                "trained_at": datetime.now().isoformat()
            }
        
        except Exception as e:
            logger.error(f"Error fine-tuning Prophet: {e}")
            return {"status": "error", "error": str(e)}
    
    async def _fine_tune_fallback(self, node_id: str, training_data: np.ndarray) -> Dict:
        """Fine-tuning for fallback mode (store statistics)"""
        try:
            stats = {
                'mean': float(np.mean(training_data)),
                'std': float(np.std(training_data)),
                'min': float(np.min(training_data)),
                'max': float(np.max(training_data)),
                'trend': float((training_data[-1] - training_data[0]) / len(training_data))
            }
            
            self.model_stats[node_id] = {
                'stats': stats,
                'trained_at': datetime.now(),
                'training_samples': len(training_data)
            }
            
            logger.info(f"✅ Statistics computed for {node_id}")
            return {
                "status": "success",
                "node_id": node_id,
                "method": "statistical",
                "training_samples": len(training_data),
                "stats": stats
            }
        except Exception as e:
            return {"status": "error", "error": str(e)}
    
    def predict_with_fine_tuning(
        self,
        node_id: str,
        historical_data: np.ndarray,
        prediction_length: int = 6,
        timestamps: Optional[pd.DatetimeIndex] = None
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Use fine-tuned model if available, otherwise zero-shot
        """
        try:
            # Check if we have a trained model
            if node_id in self.trained_models and self.prophet_available:
                model_info = self.trained_models[node_id]
                model = model_info['model']
                
                # Generate timestamps if not provided
                if timestamps is None:
                    end_time = datetime.now()
                    timestamps = pd.date_range(
                        end=end_time,
                        periods=len(historical_data),
                        freq='H'
                    )
                
                # Prepare data
                df = pd.DataFrame({
                    'ds': timestamps,
                    'y': historical_data
                })
                
                # Update model with recent data (incremental learning)
                try:
                    # Re-fit on recent data
                    recent_df = df[-min(168, len(df)):]  # Last week
                    model.fit(recent_df)
                    
                    # Make prediction
                    future = model.make_future_dataframe(periods=prediction_length, freq='H')
                    forecast = model.predict(future)
                    
                    predictions = forecast['yhat'].values[-prediction_length:]
                    lower_bound = forecast['yhat_lower'].values[-prediction_length:]
                    upper_bound = forecast['yhat_upper'].values[-prediction_length:]
                    
                    # Ensure non-negative
                    predictions = np.maximum(predictions, 0)
                    lower_bound = np.maximum(lower_bound, 0)
                    upper_bound = np.maximum(upper_bound, 0)
                    
                    logger.info(f"Fine-tuned Prophet prediction for {node_id}")
                    return predictions, lower_bound, upper_bound
                
                except:
                    # If incremental learning fails, use zero-shot
                    pass
            
            # Fall back to zero-shot
            return self.predict_zero_shot(historical_data, prediction_length, timestamps)
        
        except Exception as e:
            logger.error(f"Error in fine-tuned prediction: {e}")
            return self.predict_zero_shot(historical_data, prediction_length, timestamps)
    
    def get_model_info(self, node_id: str) -> Dict:
        """Get information about trained model"""
        if node_id in self.trained_models:
            info = self.trained_models[node_id].copy()
            info.pop('model', None)  # Don't return model object
            return info
        elif node_id in self.model_stats:
            return self.model_stats[node_id]
        else:
            return {"status": "no_model", "message": "No trained model for this node"}

# Global instance
foundation_forecaster = FoundationForecaster()