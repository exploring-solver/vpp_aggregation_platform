// src/repositories/analytics.repo.js
import Analytics from "../models/analytics.model.js";

export const upsert = async (nodeId, period, doc) => {
  return await Analytics.findOneAndUpdate({ nodeId, period }, { $set: doc }, { upsert: true, new: true });
};

export const get = async (nodeId, period) => {
  return await Analytics.findOne({ nodeId, period }).lean();
};

export const listByNode = async (nodeId, { limit = 50 } = {}) => {
  return await Analytics.find({ nodeId }).sort({ generatedAt: -1 }).limit(limit).lean();
};
