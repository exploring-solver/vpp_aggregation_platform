// src/services/analytics.service.js
import * as TelemetryRepo from "../repositories/telemetry.repo.js";
import * as AnalyticsRepo from "../repositories/analytics.repo.js";
import logger from "../utils/logger.js";

/**
 * Build simple aggregates (average, min, max) for numeric keys in metrics
 * telemetryRows is an array of telemetry docs
 */
const computeAggregates = (telemetryRows = []) => {
  const metricKeys = new Set();
  for (const r of telemetryRows) {
    if (r.metrics && typeof r.metrics === "object") {
      Object.keys(r.metrics).forEach((k) => metricKeys.add(k));
    }
  }
  const metrics = {};
  for (const k of metricKeys) {
    const values = telemetryRows
      .map((r) => {
        const v = r.metrics?.[k];
        return typeof v === "number" ? v : null;
      })
      .filter((v) => v !== null && v !== undefined);

    if (values.length === 0) continue;
    const sum = values.reduce((a, b) => a + b, 0);
    metrics[k] = {
      count: values.length,
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }
  return metrics;
};

/**
 * Run ETL for a node over a time window and store analytics
 * start and end are Date objects
 */
export const runAggregationForNode = async (nodeId, start, end) => {
  const telemetryRows = await TelemetryRepo.findRange({ from: start, to: end, limit: 10000 });

  // filter by node if provided
  const nodeRows = nodeId ? telemetryRows.filter((r) => r.nodeId === nodeId) : telemetryRows;
  if (nodeId && nodeRows.length === 0) {
    logger.info(`No telemetry for node ${nodeId} in window ${start} - ${end}`);
  }

  const metrics = computeAggregates(nodeRows);

  const period = `${start.toISOString()}_${end.toISOString()}`; // human readable unique period string
  const doc = {
    nodeId: nodeId || "ALL",
    period,
    start,
    end,
    metrics,
    metadata: { rowCount: nodeRows.length },
    generatedAt: new Date()
  };

  await AnalyticsRepo.upsert(doc.nodeId, period, doc);
  return doc;
};

/**
 * Run periodic ETL across nodes; this is a loose example that can be called from scheduler
 */
export const runScheduledETL = async ({ windowMinutes = 5 } = {}) => {
  const end = new Date();
  const start = new Date(Date.now() - windowMinutes * 60 * 1000);
  logger.info(`ETL: aggregating telemetry ${start.toISOString()} -> ${end.toISOString()}`);
  const result = await runAggregationForNode(null, start, end);
  logger.info("ETL: done", result.metadata);
  return result;
};
