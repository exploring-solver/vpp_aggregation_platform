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

    // Store in MongoDB (with error handling)
    try {
      const collection = getCollection('telemetry');
      await collection.insertOne(enrichedData);
      logger.debug(`Telemetry stored in MongoDB for node ${telemetry.dc_id}`);
    } catch (dbError) {
      logger.warn(`MongoDB storage failed for node ${telemetry.dc_id}: ${dbError.message}`);
      // Continue processing even if DB fails
    }

    // Cache latest state per node (with error handling)
    try {
      await cacheSet(`node:${telemetry.dc_id}:last_state`, enrichedData, 300);
      logger.debug(`Telemetry cached in Redis for node ${telemetry.dc_id}`);
    } catch (cacheError) {
      logger.warn(`Redis caching failed for node ${telemetry.dc_id}: ${cacheError.message}`);
      // Continue processing even if cache fails
    }

    // Publish to Redis for real-time subscribers (with error handling)
    try {
      await publishMessage('telemetry:new', enrichedData);
      logger.debug(`Telemetry published to Redis for node ${telemetry.dc_id}`);
    } catch (pubError) {
      logger.warn(`Redis publishing failed for node ${telemetry.dc_id}: ${pubError.message}`);
      // Continue processing even if publish fails
    }

    logger.info(`Telemetry processed successfully for node ${telemetry.dc_id}`);
    
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
