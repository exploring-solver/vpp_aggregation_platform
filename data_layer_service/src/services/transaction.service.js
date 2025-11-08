// src/services/transaction.service.js
import Joi from "joi";
import * as Repo from "../repositories/transaction.repo.js";

const txnSchema = Joi.object({
  type: Joi.string().required(),
  nodeId: Joi.string().optional(),
  amount: Joi.number().required(),
  currency: Joi.string().optional(),
  timestamp: Joi.date().required(),
  details: Joi.object().optional()
});

export const createTransaction = async (payload) => {
  const { error, value } = txnSchema.validate(payload);
  if (error) throw error;
  return await Repo.create(value);
};

export const listTransactions = async (q) => {
  return await Repo.list(q);
};
