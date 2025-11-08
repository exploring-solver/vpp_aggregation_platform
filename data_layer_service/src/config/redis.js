// src/config/redis.js
import { createClient } from "redis";
import env from "./env.js";
import logger from "../utils/logger.js";

let client;

export const getRedisClient = async () => {
  if (client) return client;
  if (!env.REDIS_URL) {
    logger.warn("REDIS_URL not set; caching disabled");
    return null;
  }

  client = createClient({ url: env.REDIS_URL });
  client.on("error", (err) => logger.error("Redis error", err));
  client.on("connect", () => logger.info("Redis client connecting..."));
  client.on("ready", () => logger.info("Redis ready"));

  await client.connect();
  return client;
};

export const closeRedis = async () => {
  if (!client) return;
  try {
    await client.quit();
    logger.info("Redis connection closed");
  } catch (err) {
    logger.warn("Error closing Redis", err);
  }
};
