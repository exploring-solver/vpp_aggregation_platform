from typing import Dict, Optional, List
from datetime import datetime
from config.db import db_manager
from utils.logger import logger
import mlflow
from config.config import config

class ModelRegistry:
    """Model registry for tracking versions and metadata"""
    
    def __init__(self):
        self.collection_name = "model_registry"
    
    async def register_model(
        self,
        model_type: str,
        node_id: str,
        version: str,
        metrics: Dict,
        metadata: Optional[Dict] = None
    ):
        """
        Register a trained model
        
        Args:
            model_type: 'lstm' or 'rl'
            node_id: Node identifier
            version: Model version
            metrics: Performance metrics
            metadata: Additional metadata
        """
        try:
            collection = db_manager.mongo_db[self.collection_name]
            
            doc = {
                'model_type': model_type,
                'node_id': node_id,
                'version': version,
                'metrics': metrics,
                'metadata': metadata or {},
                'registered_at': datetime.now(),
                'is_active': True,
                'status': 'production'
            }
            
            # Deactivate previous versions
            await collection.update_many(
                {
                    'model_type': model_type,
                    'node_id': node_id,
                    'is_active': True
                },
                {'$set': {'is_active': False, 'status': 'archived'}}
            )
            
            # Insert new version
            result = await collection.insert_one(doc)
            
            logger.info(f"✅ Registered {model_type} model v{version} for {node_id}")
            logger.info(f"Metrics: {metrics}")
            
            # Log to MLflow
            try:
                mlflow.log_artifact(config.MODEL_SAVE_PATH / model_type)
            except:
                pass
            
            return str(result.inserted_id)
        
        except Exception as e:
            logger.error(f"Error registering model: {e}")
            raise
    
    async def get_active_model(self, model_type: str, node_id: str) -> Optional[Dict]:
        """Get currently active model version"""
        try:
            collection = db_manager.mongo_db[self.collection_name]
            
            model = await collection.find_one(
                {
                    'model_type': model_type,
                    'node_id': node_id,
                    'is_active': True
                },
                sort=[('registered_at', -1)]
            )
            
            return model
        
        except Exception as e:
            logger.error(f"Error fetching active model: {e}")
            return None
    
    async def list_models(
        self,
        model_type: Optional[str] = None,
        node_id: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict]:
        """List registered models"""
        try:
            collection = db_manager.mongo_db[self.collection_name]
            
            query = {}
            if model_type:
                query['model_type'] = model_type
            if node_id:
                query['node_id'] = node_id
            
            cursor = collection.find(query).sort('registered_at', -1).limit(limit)
            models = await cursor.to_list(length=limit)
            
            return models
        
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []
    
    async def get_model_history(self, model_type: str, node_id: str) -> List[Dict]:
        """Get version history for a model"""
        try:
            collection = db_manager.mongo_db[self.collection_name]
            
            cursor = collection.find(
                {
                    'model_type': model_type,
                    'node_id': node_id
                }
            ).sort('registered_at', -1)
            
            history = await cursor.to_list(length=100)
            return history
        
        except Exception as e:
            logger.error(f"Error fetching model history: {e}")
            return []

# Global registry instance
model_registry = ModelRegistry()