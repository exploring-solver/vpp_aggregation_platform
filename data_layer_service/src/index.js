// src/index.js
import app from "./app.js";
import env from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { getRedisClient, closeRedis } from "./config/redis.js";
import logger from "./utils/logger.js";
import { startETLScheduler, stopETLScheduler } from "./utils/etl.js";

const PORT = env.PORT || 4000;

const start = async () => {
  try {
    await connectDB();
    await getRedisClient().catch(() => null); // optional
    startETLScheduler();

    const server = app.listen(PORT, () => {
      logger.info(`Data Layer Service listening on port ${PORT}`);
    });

    const shutdown = async () => {
      logger.info("Shutting down...");
      server.close();
      stopETLScheduler();
      await closeRedis().catch(() => null);
      await disconnectDB();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    process.on("uncaughtException", (err) => {
      logger.error("uncaughtException", err);
      shutdown();
    });
    process.on("unhandledRejection", (err) => {
      logger.error("unhandledRejection", err);
    });
  } catch (err) {
    logger.error("Startup failed", err);
    process.exit(1);
  }
};

start();
