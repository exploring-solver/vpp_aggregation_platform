"""
Service to ingest data from external sources
Supports both PULL (query backend) and PUSH (webhook) modes
"""
import asyncio
from datetime import datetime
from typing import Dict, List
import aiohttp
from config.config import config
from config.db import db_manager
from utils.logger import logger

class DataIngestionService:
    """Handle data ingestion from Node.js backend"""
    
    def __init__(self):
        self.running = False
        self.pull_task = None
    
    async def start(self):
        """Start data ingestion service"""
        if config.DATA_INGESTION_MODE == 'pull':
            logger.info(f"🔄 Starting PULL mode data ingestion (every {config.PULL_INTERVAL_SECONDS}s)")
            self.running = True
            self.pull_task = asyncio.create_task(self._pull_loop())
        else:
            logger.info("📥 PUSH mode enabled - waiting for webhooks")
    
    async def stop(self):
        """Stop data ingestion service"""
        self.running = False
        if self.pull_task:
            self.pull_task.cancel()
    
    async def _pull_loop(self):
        """Continuously pull data from Node.js backend"""
        while self.running:
            try:
                await self._pull_telemetry()
                await asyncio.sleep(config.PULL_INTERVAL_SECONDS)
            except Exception as e:
                logger.error(f"Error in pull loop: {e}")
                await asyncio.sleep(10)
    
    async def _pull_telemetry(self):
        """Pull telemetry data from Node.js backend"""
        try:
            url = f"{config.NODEJS_BACKEND_URL}{config.NODEJS_ENDPOINTS['nodes_list']}"
            
            async with aiohttp.ClientSession() as session:
                # Get list of active nodes
                async with session.get(url, timeout=5) as response:
                    if response.status != 200:
                        logger.warning(f"Failed to get nodes list: HTTP {response.status}")
                        return
                    
                    nodes_data = await response.json()
                    nodes = nodes_data.get('nodes', [])
                    
                    # Fetch telemetry for each node
                    for node in nodes[:10]:  # Limit to 10 nodes per pull
                        await self._pull_node_telemetry(session, node['id'])
        
        except aiohttp.ClientConnectorError:
            logger.debug("Backend not available for data pull")
        except Exception as e:
            logger.error(f"Error pulling telemetry: {e}")
    
    async def _pull_node_telemetry(self, session: aiohttp.ClientSession, node_id: str):
        """Pull telemetry for specific node"""
        try:
            url = f"{config.NODEJS_BACKEND_URL}{config.NODEJS_ENDPOINTS['node_telemetry'].format(node_id=node_id)}"
            
            async with session.get(url, timeout=5) as response:
                if response.status == 200:
                    telemetry = await response.json()
                    await self._store_telemetry(telemetry)
        
        except Exception as e:
            logger.debug(f"Error pulling telemetry for {node_id}: {e}")
    
    async def _store_telemetry(self, telemetry: Dict):
        """Store telemetry in MongoDB"""
        try:
            collection = db_manager.mongo_db['telemetries']
            await collection.insert_one(telemetry)
        except Exception as e:
            logger.error(f"Error storing telemetry: {e}")
    
    async def handle_webhook(self, data: Dict):
        """Handle incoming webhook data (PUSH mode)"""
        try:
            logger.info(f"📥 Received webhook data for {data.get('nodeId')}")
            await self._store_telemetry(data)
        except Exception as e:
            logger.error(f"Error handling webhook: {e}")

# Global instance
data_ingestion_service = DataIngestionService()