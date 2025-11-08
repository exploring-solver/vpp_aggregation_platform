// src/repositories/metadata.repo.js
import Metadata from "../models/metadata.model.js";

export const upsert = async (dataCenterId, doc) => {
  return await Metadata.findOneAndUpdate({ dataCenterId }, { $set: doc }, { upsert: true, new: true });
};

export const getById = async (dataCenterId) => {
  return await Metadata.findOne({ dataCenterId }).lean();
};

export const list = async (filter = {}, { limit = 100, skip = 0 } = {}) => {
  return await Metadata.find(filter).limit(limit).skip(skip).lean();
};
