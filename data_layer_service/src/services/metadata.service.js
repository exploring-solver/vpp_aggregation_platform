// src/services/metadata.service.js
import * as Repo from "../repositories/metadata.repo.js";
import Joi from "joi";

const schema = Joi.object({
  nodeId: Joi.string().required(),
  dataCenterId: Joi.string().required(),
  name: Joi.string().optional(),
  capacity: Joi.object({
    rated: Joi.number().required(),
    available: Joi.number().required()
  }).required(),
  location: Joi.string().optional(),
  coords: Joi.object({ lat: Joi.number(), lon: Joi.number() }).optional(),
  tariff: Joi.number().optional(),
  properties: Joi.object().optional()
});

export const upsertMetadata = async (doc) => {
  const { error, value } = schema.validate(doc);
  if (error) throw error;
  return await Repo.upsert(value.dataCenterId, value);
};

export const getMetadata = async (dataCenterId) => {
  return await Repo.getById(dataCenterId);
};

export const listMetadata = async (filter, paging) => {
  return await Repo.list(filter, paging);
};
