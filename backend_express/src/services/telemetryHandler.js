import { getCollection } from './database.js';
import { publishMessage, cacheSet } from './redis.js';
import logger from '../utils/logger.js';

export async function handleTelemetryData(telemetry) {
  try {
    // Validate and enrich telemetry data
    const enrichedData = {
      ...telemetry,
      timestamp: telemetry.timestamp || new Date(),
      received_at: new Date()
    };

    // Store in MongoDB
    const collection = getCollection('telemetry');
    await collection.insertOne(enrichedData);

    // Cache latest state per node
    await cacheSet(`node:${telemetry.dc_id}:last_state`, enrichedData, 300);

    // Publish to Redis for real-time subscribers
    await publishMessage('telemetry:new', enrichedData);

    logger.debug(`Telemetry stored for node ${telemetry.dc_id}`);
    
    return enrichedData;
  } catch (error) {
    logger.error('Error handling telemetry:', error);
    throw error;
  }
}

export async function getLatestTelemetry(dcId, limit = 100) {
  const collection = getCollection('telemetry');
  
  const query = dcId ? { dc_id: dcId } : {};
  
  return await collection
    .find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray();
}

export async function getTelemetryInRange(dcId, startTime, endTime) {
  const collection = getCollection('telemetry');
  
  const query = {
    ...(dcId && { dc_id: dcId }),
    timestamp: {
      $gte: new Date(startTime),
      $lte: new Date(endTime)
    }
  };
  
  return await collection
    .find(query)
    .sort({ timestamp: 1 })
    .toArray();
}
