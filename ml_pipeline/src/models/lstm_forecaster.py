
import numpy as np
import tensorflow as tf
from tensorflow import keras
from keras import layers, Model
from keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
from typing import Tuple, Dict, Optional
import json
from pathlib import Path
from utils.logger import logger
from config.config import config

class LSTMForecaster:
    """LSTM model for time-series forecasting of power output and grid metrics"""
    
    def __init__(
        self,
        sequence_length: int = 24,
        n_features: int = 6,
        forecast_horizon: int = 6,
        lstm_units: list = [128, 64],
        dropout_rate: float = 0.2
    ):
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.forecast_horizon = forecast_horizon
        self.lstm_units = lstm_units
        self.dropout_rate = dropout_rate
        self.model = None
        self.history = None
        self.model_path = config.MODEL_SAVE_PATH / "lstm_forecaster"
        self.model_path.mkdir(parents=True, exist_ok=True)
    
    def build_model(self) -> Model:
        """Build LSTM architecture"""
        try:
            inputs = layers.Input(shape=(self.sequence_length, self.n_features))
            x = inputs
            
            # Stacked LSTM layers
            for i, units in enumerate(self.lstm_units):
                return_sequences = i < len(self.lstm_units) - 1
                x = layers.LSTM(
                    units,
                    return_sequences=return_sequences,
                    dropout=self.dropout_rate,
                    recurrent_dropout=self.dropout_rate,
                    name=f'lstm_{i+1}'
                )(x)
                x = layers.BatchNormalization()(x)
            
            # Dense layers for forecasting
            x = layers.Dense(64, activation='relu')(x)
            x = layers.Dropout(self.dropout_rate)(x)
            x = layers.Dense(32, activation='relu')(x)
            
            # Output layer - forecast multiple steps
            outputs = layers.Dense(self.forecast_horizon, name='forecast_output')(x)
            
            model = Model(inputs=inputs, outputs=outputs, name='LSTM_Forecaster')
            
            # Compile with custom metrics
            model.compile(
                optimizer=keras.optimizers.Adam(learning_rate=0.001),
                loss='huber',  # Robust to outliers
                metrics=[
                    'mae',
                    'mse',
                    tf.keras.metrics.RootMeanSquaredError(name='rmse')
                ]
            )
            
            self.model = model
            logger.info(f"Built LSTM model with architecture: {[self.sequence_length, self.n_features]} -> {self.lstm_units} -> {self.forecast_horizon}")
            return model
            
        except Exception as e:
            logger.error(f"Error building LSTM model: {e}")
            raise
    
    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: np.ndarray,
        y_val: np.ndarray,
        epochs: int = 100,
        batch_size: int = 32,
        verbose: int = 1
    ) -> Dict:
        """
        Train the LSTM model
        
        Args:
            X_train: Training sequences (samples, timesteps, features)
            y_train: Training targets (samples, forecast_horizon)
            X_val: Validation sequences
            y_val: Validation targets
            epochs: Number of training epochs
            batch_size: Batch size
            verbose: Verbosity level
        
        Returns:
            Training history and metrics
        """
        try:
            if self.model is None:
                self.build_model()
            
            # Callbacks
            callbacks = [
                EarlyStopping(
                    monitor='val_loss',
                    patience=15,
                    restore_best_weights=True,
                    verbose=1
                ),
                ModelCheckpoint(
                    filepath=str(self.model_path / 'best_model.h5'),
                    monitor='val_loss',
                    save_best_only=True,
                    verbose=1
                ),
                ReduceLROnPlateau(
                    monitor='val_loss',
                    factor=0.5,
                    patience=5,
                    min_lr=1e-7,
                    verbose=1
                )
            ]
            
            # Train
            logger.info(f"Starting LSTM training: {X_train.shape[0]} samples, {epochs} epochs")
            self.history = self.model.fit(
                X_train, y_train,
                validation_data=(X_val, y_val),
                epochs=epochs,
                batch_size=batch_size,
                callbacks=callbacks,
                verbose=verbose
            )
            
            # Evaluate on validation set
            val_metrics = self.model.evaluate(X_val, y_val, verbose=0)
            
            results = {
                'epochs_trained': len(self.history.history['loss']),
                'final_train_loss': float(self.history.history['loss'][-1]),
                'final_val_loss': float(self.history.history['val_loss'][-1]),
                'val_mae': float(val_metrics[1]),
                'val_rmse': float(val_metrics[3]),
                'best_val_loss': float(min(self.history.history['val_loss']))
            }
            
            logger.info(f"Training completed: {results}")
            return results
            
        except Exception as e:
            logger.error(f"Error training LSTM: {e}")
            raise
    
    def predict(self, X: np.ndarray) -> np.ndarray:
        """Make predictions"""
        if self.model is None:
            raise ValueError("Model not trained or loaded")
        return self.model.predict(X, verbose=0)
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Evaluate model on test set"""
        metrics = self.model.evaluate(X_test, y_test, verbose=0)
        return {
            'test_loss': float(metrics[0]),
            'test_mae': float(metrics[1]),
            'test_mse': float(metrics[2]),
            'test_rmse': float(metrics[3])
        }
    
    def save(self, version: str = "latest"):
        """Save model and configuration"""
        try:
            # Save model
            model_file = self.model_path / f"model_{version}.h5"
            self.model.save(model_file)
            
            # Save config
            config_data = {
                'sequence_length': self.sequence_length,
                'n_features': self.n_features,
                'forecast_horizon': self.forecast_horizon,
                'lstm_units': self.lstm_units,
                'dropout_rate': self.dropout_rate
            }
            
            config_file = self.model_path / f"config_{version}.json"
            with open(config_file, 'w') as f:
                json.dump(config_data, f, indent=2)
            
            logger.info(f"Saved LSTM model version: {version}")
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            raise
    
    def load(self, version: str = "latest"):
        """Load model and configuration"""
        try:
            model_file = self.model_path / f"model_{version}.h5"
            if not model_file.exists():
                raise FileNotFoundError(f"Model file not found: {model_file}")
            
            self.model = keras.models.load_model(model_file)
            
            # Load config
            config_file = self.model_path / f"config_{version}.json"
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            
            self.sequence_length = config_data['sequence_length']
            self.n_features = config_data['n_features']
            self.forecast_horizon = config_data['forecast_horizon']
            self.lstm_units = config_data['lstm_units']
            self.dropout_rate = config_data['dropout_rate']
            
            logger.info(f"Loaded LSTM model version: {version}")
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            raise
    
    def get_model_summary(self) -> str:
        """Get model architecture summary"""
        if self.model is None:
            return "Model not built"
        
        from io import StringIO
        stream = StringIO()
        self.model.summary(print_fn=lambda x: stream.write(x + '\n'))
        return stream.getvalue()