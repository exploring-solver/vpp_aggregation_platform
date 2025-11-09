import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from typing import Tuple, Optional
import pickle
from pathlib import Path
from utils.logger import logger
from config.config import config

class DataPreprocessor:
    """Preprocess data for ML models"""
    
    def __init__(self):
        self.scalers = {}
        self.scaler_path = config.MODEL_SAVE_PATH / "scalers"
        self.scaler_path.mkdir(parents=True, exist_ok=True)
    
    def fit_transform(
        self,
        data: np.ndarray,
        scaler_name: str = "default",
        scaler_type: str = "standard"
    ) -> np.ndarray:
        """
        Fit scaler and transform data
        
        Args:
            data: Input data
            scaler_name: Name to save scaler under
            scaler_type: 'standard' or 'minmax'
        
        Returns:
            Scaled data
        """
        try:
            if scaler_type == "standard":
                scaler = StandardScaler()
            elif scaler_type == "minmax":
                scaler = MinMaxScaler()
            else:
                raise ValueError(f"Unknown scaler type: {scaler_type}")
            
            # Reshape if needed
            original_shape = data.shape
            if len(original_shape) == 3:  # For LSTM: (samples, timesteps, features)
                samples, timesteps, features = original_shape
                data_reshaped = data.reshape(-1, features)
                scaled = scaler.fit_transform(data_reshaped)
                scaled = scaled.reshape(original_shape)
            else:
                scaled = scaler.fit_transform(data)
            
            # Save scaler
            self.scalers[scaler_name] = scaler
            self.save_scaler(scaler, scaler_name)
            
            logger.info(f"Fitted and transformed data with {scaler_type} scaler: {scaler_name}")
            return scaled
            
        except Exception as e:
            logger.error(f"Error in fit_transform: {e}")
            raise
    
    def transform(
        self,
        data: np.ndarray,
        scaler_name: str = "default"
    ) -> np.ndarray:
        """Transform data using existing scaler"""
        try:
            scaler = self.load_scaler(scaler_name)
            
            original_shape = data.shape
            if len(original_shape) == 3:
                samples, timesteps, features = original_shape
                data_reshaped = data.reshape(-1, features)
                scaled = scaler.transform(data_reshaped)
                scaled = scaled.reshape(original_shape)
            else:
                scaled = scaler.transform(data)
            
            return scaled
            
        except Exception as e:
            logger.error(f"Error in transform: {e}")
            raise
    
    def inverse_transform(
        self,
        data: np.ndarray,
        scaler_name: str = "default"
    ) -> np.ndarray:
        """Inverse transform scaled data"""
        try:
            scaler = self.load_scaler(scaler_name)
            
            original_shape = data.shape
            if len(original_shape) == 3:
                samples, timesteps, features = original_shape
                data_reshaped = data.reshape(-1, features)
                unscaled = scaler.inverse_transform(data_reshaped)
                unscaled = unscaled.reshape(original_shape)
            else:
                unscaled = scaler.inverse_transform(data)
            
            return unscaled
            
        except Exception as e:
            logger.error(f"Error in inverse_transform: {e}")
            raise
    
    def save_scaler(self, scaler, name: str):
        """Save scaler to disk"""
        path = self.scaler_path / f"{name}.pkl"
        with open(path, 'wb') as f:
            pickle.dump(scaler, f)
        logger.debug(f"Saved scaler: {name}")
    
    def load_scaler(self, name: str):
        """Load scaler from disk"""
        if name in self.scalers:
            return self.scalers[name]
        
        path = self.scaler_path / f"{name}.pkl"
        if not path.exists():
            raise FileNotFoundError(f"Scaler not found: {name}")
        
        with open(path, 'rb') as f:
            scaler = pickle.load(f)
        
        self.scalers[name] = scaler
        return scaler
    
    def handle_missing_values(
        self,
        df: pd.DataFrame,
        strategy: str = "forward_fill"
    ) -> pd.DataFrame:
        """Handle missing values in DataFrame"""
        if strategy == "forward_fill":
            return df.fillna(method='ffill').fillna(method='bfill')
        elif strategy == "mean":
            return df.fillna(df.mean())
        elif strategy == "drop":
            return df.dropna()
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
    
    def create_time_features(self, df: pd.DataFrame, timestamp_col: str = 'timestamp') -> pd.DataFrame:
        """Extract time-based features"""
        df = df.copy()
        df[timestamp_col] = pd.to_datetime(df[timestamp_col])
        
        df['hour'] = df[timestamp_col].dt.hour
        df['day_of_week'] = df[timestamp_col].dt.dayofweek
        df['month'] = df[timestamp_col].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Cyclical encoding
        df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
        df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)
        df['day_sin'] = np.sin(2 * np.pi * df['day_of_week'] / 7)
        df['day_cos'] = np.cos(2 * np.pi * df['day_of_week'] / 7)
        
        return df

# Global instance
preprocessor = DataPreprocessor()