// src/repositories/telemetry.repo.js
import Telemetry from "../models/telemetry.model.js";

export const insertMany = async (docs = []) => {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  return await Telemetry.insertMany(docs, { ordered: false }).catch((e) => {
    // ignore duplicate key errors or partial failures
    return e.insertedDocs || [];
  });
};

export const create = async (doc) => {
  return await Telemetry.create(doc);
};

export const findByNode = async (nodeId, { limit = 100, from, to } = {}) => {
  const q = { nodeId };
  if (from || to) q.timestamp = {};
  if (from) q.timestamp.$gte = from;
  if (to) q.timestamp.$lte = to;

  return await Telemetry.find(q).sort({ timestamp: -1 }).limit(limit).lean();
};

export const findRange = async ({ from, to, limit = 1000 } = {}) => {
  const q = {};
  if (from || to) q.timestamp = {};
  if (from) q.timestamp.$gte = from;
  if (to) q.timestamp.$lte = to;
  return await Telemetry.find(q).sort({ timestamp: -1 }).limit(limit).lean();
};

export const getAggregatedData = async (nodeId, granularity = 'hour', startDate, endDate) => {
  let groupId;
  
  switch (granularity) {
    case 'minute':
      groupId = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' },
        minute: { $minute: '$timestamp' }
      };
      break;
    case 'hour':
      groupId = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' }
      };
      break;
    case 'day':
      groupId = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      };
      break;
    default:
      groupId = '$timestamp';
  }

  return await Telemetry.aggregate([
    { 
      $match: {
        nodeId,
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: groupId,
        avgPowerOutput: { $avg: '$powerOutput' },
        maxPowerOutput: { $max: '$powerOutput' },
        minPowerOutput: { $min: '$powerOutput' },
        avgEfficiency: { $avg: '$efficiency' },
        avgTemperature: { $avg: '$temperature' },
        totalGeneration: { 
          $sum: { $multiply: ['$powerOutput', 1/60] } // kWh
        },
        dataPoints: { $sum: 1 },
        timestamp: { $first: '$timestamp' }
      }
    },
    { $sort: { timestamp: 1 } }
  ]);
};