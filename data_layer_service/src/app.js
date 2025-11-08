// src/app.js
import express from "express";
import morgan from "morgan";
import telemetryRoutes from "./routes/telemetry.routes.js";
import metadataRoutes from "./routes/metadata.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import analyticsRoutes from "./routes/analytics.routes.js";
import logger from "./utils/logger.js";
import env from "./config/env.js";

const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Basic health
app.get("/health", (req, res) => res.json({ status: "ok", env: env.NODE_ENV }));

// API routes
app.use("/api/telemetry", telemetryRoutes);
app.use("/api/metadata", metadataRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/analytics", analyticsRoutes);

// global error handler (last middleware)
app.use((err, req, res, next) => {
  logger.error("Unhandled error in request pipeline", err);
  res.status(500).json({ success: false, error: err.message || "Internal error" });
});

export default app;
