// src/services/telemetry.service.js
import Joi from "joi";
import * as Repo from "../repositories/telemetry.repo.js";
import { getRedisClient } from "../config/redis.js";
import logger from "../utils/logger.js";

// Support both old and new schemas
const telemetrySchema = Joi.object({
  nodeId: Joi.string().required(),
  timestamp: Joi.date().required(),
  
  // Core required fields
  powerOutput: Joi.number().required(),
  voltage: Joi.number().required(),
  current: Joi.number().required(),
  frequency: Joi.number().required(),
  
  // Optional fields
  temperature: Joi.number().optional(),
  efficiency: Joi.number().optional(),
  batteryLevel: Joi.number().optional(),
  
  weatherConditions: Joi.object().optional(),
  gridMetrics: Joi.object().optional(),
  alarms: Joi.array().optional(),
  performance: Joi.object().optional(),
  dataQuality: Joi.object().optional(),
  
  // Legacy support
  metrics: Joi.object().optional(),
  tags: Joi.array().items(Joi.string()).optional()
}).or('metrics', 'powerOutput'); // Either legacy metrics OR new fields

export const ingest = async (payload) => {
  const docs = Array.isArray(payload) ? payload : [payload];

  const valid = [];
  for (const d of docs) {
    const { error, value } = telemetrySchema.validate(d, { stripUnknown: false });
    if (error) {
      logger.warn("Invalid telemetry payload", error.message);
      continue;
    }
    
    // Calculate data quality if not provided
    if (!value.dataQuality) {
      value.dataQuality = {
        completeness: calculateCompleteness(value),
        accuracy: 1.0,
        source: 'sensor',
        validated: false
      };
    }
    
    valid.push(value);
  }
  
  if (valid.length === 0) throw new Error("No valid telemetry documents provided");

  const inserted = await Repo.insertMany(valid);

  // Cache latest per node
  try {
    const redis = await getRedisClient();
    if (redis) {
      for (const doc of valid) {
        const key = `telemetry:latest:${doc.nodeId}`;
        await redis.set(key, JSON.stringify(doc), { EX: 300 }); // 5 min TTL
      }
    }
  } catch (err) {
    logger.warn("Redis unavailable for telemetry cache", err);
  }

  return inserted;
};

const calculateCompleteness = (data) => {
  const requiredFields = ['powerOutput', 'voltage', 'current', 'frequency'];
  const presentFields = requiredFields.filter(field => 
    data[field] !== undefined && data[field] !== null);
  return presentFields.length / requiredFields.length;
};

export const getRecent = async (nodeId, opts = {}) => {
  try {
    const redis = await getRedisClient();
    if (redis && !opts.bypassCache) {
      const cached = await redis.get(`telemetry:latest:${nodeId}`);
      if (cached) {
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    logger.warn("Redis fetch error (IGNORED)", err);
  }

  const rows = await Repo.findByNode(nodeId, opts);
  return rows;
};