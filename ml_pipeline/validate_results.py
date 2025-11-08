"""
Validate test results
"""
import asyncio
from src.config.db import db_manager
from src.utils.logger import logger

async def validate():
    """Check what's in the database"""
    try:
        await db_manager.connect_mongodb()
        
        # Check telemetry
        telemetry = db_manager.mongo_db['telemetries']
        count = await telemetry.count_documents({})
        logger.info(f"📊 Total telemetry records: {count}")
        
        # Check by node
        pipeline = [
            {'$group': {
                '_id': '$nodeId',
                'count': {'$sum': 1},
                'avgPower': {'$avg': '$powerOutput'},
                'avgSOC': {'$avg': '$batteryLevel'}
            }}
        ]
        
        results = await telemetry.aggregate(pipeline).to_list(length=100)
        
        logger.info("\n📈 Per-Node Statistics:")
        for r in results:
            logger.info(f"  {r['_id']}: {r['count']} records, "
                       f"avg power: {r['avgPower']:.2f} kW, "
                       f"avg SOC: {r['avgSOC']:.2f}%")
        
        # Check metadata
        metadata = db_manager.mongo_db['metadatas']
        meta_count = await metadata.count_documents({})
        logger.info(f"\n🏢 Metadata entries: {meta_count}")
        
        # Check active controls
        controls = db_manager.mongo_db['control_logs']
        control_count = await controls.count_documents({})
        logger.info(f"⚡ Control logs: {control_count}")
        
    except Exception as e:
        logger.error(f"❌ Error: {e}")
    finally:
        await db_manager.close()

if __name__ == "__main__":
    asyncio.run(validate())