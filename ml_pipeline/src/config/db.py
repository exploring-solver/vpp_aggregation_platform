from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
import redis.asyncio as aioredis
from config.config import config
from utils.logger import logger

class DatabaseManager:
    def __init__(self):
        self.mongo_client = None
        self.mongo_db = None
        self.redis_client = None
        self._sync_client = None
        
    async def connect_mongodb(self):
        """Connect to MongoDB"""
        try:
            self.mongo_client = AsyncIOMotorClient(config.MONGO_URI)
            self.mongo_db = self.mongo_client[config.MONGO_DB_NAME]
            # Test connection
            await self.mongo_db.command('ping')
            logger.info("✅ Connected to MongoDB")
        except Exception as e:
            logger.error(f"❌ MongoDB connection failed: {e}")
            raise
    
    async def connect_redis(self):
        """Connect to Redis"""
        try:
            self.redis_client = await aioredis.from_url(
                config.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            await self.redis_client.ping()
            logger.info("✅ Connected to Redis")
        except Exception as e:
            logger.error(f"❌ Redis connection failed: {e}")
            logger.warning("Continuing without Redis cache")
    
    async def close(self):
        """Close all connections"""
        if self.mongo_client:
            self.mongo_client.close()
            logger.info("MongoDB connection closed")
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis connection closed")
        if self._sync_client:
            self._sync_client.close()
    
    def get_sync_client(self):
        """Get synchronous MongoDB client for training scripts"""
        if not self._sync_client:
            self._sync_client = MongoClient(config.MONGO_URI)
        return self._sync_client[config.MONGO_DB_NAME]

# Global database manager
db_manager = DatabaseManager()