// src/repositories/transaction.repo.js
import Transaction from "../models/transaction.model.js";

export const create = async (doc) => {
  return await Transaction.create(doc);
};

export const list = async ({ type, from, to, limit = 100 } = {}) => {
  const q = {};
  if (type) q.type = type;
  if (from || to) q.timestamp = {};
  if (from) q.timestamp.$gte = from;
  if (to) q.timestamp.$lte = to;
  return await Transaction.find(q).sort({ timestamp: -1 }).limit(limit).lean();
};
