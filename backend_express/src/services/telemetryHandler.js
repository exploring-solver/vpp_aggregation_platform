import { getCollection } from './database.js';
import { publishMessage, cacheSet } from './redis.js';
import logger from '../utils/logger.js';

export async function handleTelemetryData(telemetry, nodeAuth = null) {
  try {
    // Auto-register node if not already registered (works with or without auth now)
    const nodeId = nodeAuth?.nodeId || telemetry.dc_id;
    if (nodeId) {
      await ensureNodeRegistered(nodeId, telemetry);
    }

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

// Auto-register nodes when they first send telemetry
async function ensureNodeRegistered(nodeId, telemetry) {
  try {
    const collection = getCollection('nodes');
    const existingNode = await collection.findOne({ dc_id: nodeId });
    
    // Calculate capacity from telemetry if not provided
    const powerKw = telemetry.power_kw || 100; // Default 100 kW
    const batteryKwh = telemetry.meta?.battery_kwh || telemetry.battery_kwh || 200; // Default 200 kWh
    const capacityKw = Math.max(powerKw * 1.5, 150); // Capacity should be higher than current power
    
    if (!existingNode) {
      const nodeData = {
        dc_id: nodeId,
        node_id: nodeId,
        node_name: telemetry.node_name || `Edge Node ${nodeId}`,
        node_location: telemetry.node_location || telemetry.meta?.location || 'Unknown',
        node_type: telemetry.node_type || 'edge_device',
        status: 'online',
        capacity_kw: capacityKw,
        battery_kwh: batteryKwh,
        region: telemetry.region || 'default',
        created_at: new Date(),
        updated_at: new Date(),
        auto_registered: true,
        first_seen: new Date(),
        capabilities: telemetry.capabilities || ['charge', 'discharge', 'defer_load'],
        metadata: {
          initial_telemetry: {
            power_kw: telemetry.power_kw,
            soc: telemetry.soc,
            freq: telemetry.freq
          }
        }
      };
      
      await collection.insertOne(nodeData);
      logger.info(`Auto-registered new node: ${nodeId} (${nodeData.node_name}) with capacity ${capacityKw}kW, battery ${batteryKwh}kWh`);
    } else {
      // Update last seen, status, and capacity if missing
      const updateData = {
        status: 'online',
        updated_at: new Date(),
        last_seen: new Date()
      };
      
      // Update capacity if not set or if telemetry provides better data
      if (!existingNode.capacity_kw || (telemetry.power_kw && telemetry.power_kw > existingNode.capacity_kw * 0.8)) {
        updateData.capacity_kw = capacityKw;
      }
      if (!existingNode.battery_kwh || (telemetry.meta?.battery_kwh && telemetry.meta.battery_kwh > existingNode.battery_kwh)) {
        updateData.battery_kwh = batteryKwh;
      }
      
      await collection.updateOne(
        { dc_id: nodeId },
        { $set: updateData }
      );
    }
  } catch (error) {
    logger.error(`Failed to ensure node ${nodeId} registration:`, error);
    // Don't throw - telemetry processing should continue even if registration fails
  }
}
