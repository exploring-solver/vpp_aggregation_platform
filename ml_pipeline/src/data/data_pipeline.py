import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from src.config.db import db_manager
from src.utils.logger import logger

class DataPipeline:
    """Extract and prepare data from MongoDB for ML training"""
    
    def __init__(self):
        # Use async client from db_manager instead of creating sync client
        pass
    
    async def fetch_telemetry_data(
        self,
        node_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 10000
    ) -> pd.DataFrame:
        """
        Fetch telemetry data from MongoDB
        
        Args:
            node_id: Specific node ID or None for all nodes
            start_date: Start datetime
            end_date: End datetime
            limit: Maximum records to fetch
        
        Returns:
            DataFrame with telemetry data
        """
        try:
            # Default to last 30 days if not specified
            if not end_date:
                end_date = datetime.now()
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            # Build query
            query = {
                "timestamp": {"$gte": start_date, "$lte": end_date}
            }
            if node_id:
                query["nodeId"] = node_id
            
            # Use async client from db_manager
            collection = db_manager.mongo_db["telemetries"]
            cursor = collection.find(query).sort("timestamp", 1).limit(limit)
            
            # Convert to list
            data = await cursor.to_list(length=limit)
            
            if not data:
                logger.warning(f"No telemetry data found for query: {query}")
                return pd.DataFrame()
            
            # Convert to DataFrame
            df = pd.DataFrame(data)
            
            # Extract nested metrics if present
            if 'metrics' in df.columns:
                metrics_df = pd.json_normalize(df['metrics'])
                df = pd.concat([df.drop('metrics', axis=1), metrics_df], axis=1)
            
            logger.info(f"Fetched {len(df)} telemetry records")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching telemetry data: {e}")
            raise
    
    async def fetch_transaction_data(
        self,
        node_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        transaction_type: Optional[str] = None
    ) -> pd.DataFrame:
        """Fetch transaction/market data"""
        try:
            if not end_date:
                end_date = datetime.now()
            if not start_date:
                start_date = end_date - timedelta(days=30)
            
            query = {
                "timestamp": {"$gte": start_date, "$lte": end_date}
            }
            if node_id:
                query["nodeId"] = node_id
            if transaction_type:
                query["type"] = transaction_type
            
            collection = db_manager.mongo_db["transactions"]
            cursor = collection.find(query).sort("timestamp", 1)
            data = await cursor.to_list(length=10000)
            
            if not data:
                return pd.DataFrame()
            
            df = pd.DataFrame(data)
            logger.info(f"Fetched {len(df)} transaction records")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching transaction data: {e}")
            raise
    
    async def fetch_metadata(self, node_id: Optional[str] = None) -> List[Dict]:
        """Fetch node metadata"""
        try:
            collection = db_manager.mongo_db["metadatas"]
            query = {} if not node_id else {"nodeId": node_id}
            cursor = collection.find(query)
            data = await cursor.to_list(length=1000)
            logger.info(f"Fetched metadata for {len(data)} nodes")
            return data
        except Exception as e:
            logger.error(f"Error fetching metadata: {e}")
            raise
    
    async def prepare_lstm_dataset(
        self,
        node_id: str,
        lookback: int = 24,
        forecast_horizon: int = 6
    ) -> Tuple[np.ndarray, np.ndarray, Dict]:
        """
        Prepare time-series data for LSTM training
        
        Args:
            node_id: Node identifier
            lookback: Number of historical timesteps
            forecast_horizon: Number of steps to forecast
        
        Returns:
            X (input sequences), y (targets), metadata
        """
        try:
            df = await self.fetch_telemetry_data(node_id=node_id, limit=50000)
            
            if df.empty or len(df) < lookback + forecast_horizon:
                raise ValueError(f"Insufficient data for node {node_id}")
            
            # Select features for LSTM
            feature_cols = [
                'powerOutput', 'voltage', 'current', 
                'frequency', 'temperature', 'efficiency'
            ]
            
            # Handle missing columns
            available_cols = [col for col in feature_cols if col in df.columns]
            if not available_cols:
                raise ValueError("No valid feature columns found")
            
            # Sort by timestamp and extract features
            df = df.sort_values('timestamp')
            features = df[available_cols].fillna(method='ffill').fillna(0).values
            
            # Create sequences
            X, y = [], []
            for i in range(len(features) - lookback - forecast_horizon + 1):
                X.append(features[i:i + lookback])
                y.append(features[i + lookback:i + lookback + forecast_horizon, 0])  # Predict powerOutput
            
            X = np.array(X)
            y = np.array(y)
            
            metadata = {
                'node_id': node_id,
                'features': available_cols,
                'lookback': lookback,
                'forecast_horizon': forecast_horizon,
                'samples': len(X),
                'start_date': df['timestamp'].min(),
                'end_date': df['timestamp'].max()
            }
            
            logger.info(f"Prepared LSTM dataset: X shape {X.shape}, y shape {y.shape}")
            return X, y, metadata
            
        except Exception as e:
            logger.error(f"Error preparing LSTM dataset: {e}")
            raise
    
    async def prepare_rl_environment_data(
        self,
        lookback_days: int = 7
    ) -> Dict:
        """
        Prepare aggregated data for RL training environment
        
        Returns:
            Dictionary with state space data
        """
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=lookback_days)
            
            # Fetch all recent telemetry
            telemetry_df = await self.fetch_telemetry_data(
                start_date=start_date,
                end_date=end_date
            )
            
            # Fetch transactions
            transactions_df = await self.fetch_transaction_data(
                start_date=start_date,
                end_date=end_date
            )
            
            # Fetch metadata
            metadata = await self.fetch_metadata()
            
            env_data = {
                'telemetry': telemetry_df.to_dict('records') if not telemetry_df.empty else [],
                'transactions': transactions_df.to_dict('records') if not transactions_df.empty else [],
                'metadata': metadata,
                'aggregated_stats': self._calculate_aggregate_stats(telemetry_df)
            }
            
            logger.info(f"Prepared RL environment data with {len(telemetry_df)} telemetry records")
            return env_data
            
        except Exception as e:
            logger.error(f"Error preparing RL environment data: {e}")
            raise
    
    def _calculate_aggregate_stats(self, df: pd.DataFrame) -> Dict:
        """Calculate aggregate statistics from telemetry"""
        if df.empty:
            return {}
        
        stats = {}
        if 'powerOutput' in df.columns:
            stats['avg_power'] = float(df['powerOutput'].mean())
            stats['max_power'] = float(df['powerOutput'].max())
            stats['min_power'] = float(df['powerOutput'].min())
        
        if 'efficiency' in df.columns:
            stats['avg_efficiency'] = float(df['efficiency'].mean())
        
        if 'nodeId' in df.columns:
            stats['unique_nodes'] = int(df['nodeId'].nunique())
        
        return stats

# Global instance
data_pipeline = DataPipeline()