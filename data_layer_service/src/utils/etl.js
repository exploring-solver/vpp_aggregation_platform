// src/utils/etl.js
import cron from "cron";
import env from "../config/env.js";
import logger from "./logger.js";
import * as AnalyticsService from "../services/analytics.service.js";

let job;

export const startETLScheduler = () => {
  if (job) return job;
  try {
    // run every env.ETL_CRON (default every 5 minutes)
    job = new cron.CronJob(env.ETL_CRON, async () => {
      try {
        logger.info("ETL scheduler fired");
        await AnalyticsService.runScheduledETL({ windowMinutes: 5 });
      } catch (err) {
        logger.error("ETL job failed", err);
      }
    });
    job.start();
    logger.info(`ETL scheduler started (${env.ETL_CRON})`);
    return job;
  } catch (err) {
    logger.error("Failed to start ETL scheduler", err);
    throw err;
  }
};

export const stopETLScheduler = () => {
  if (job) {
    job.stop();
    logger.info("ETL scheduler stopped");
  }
};
