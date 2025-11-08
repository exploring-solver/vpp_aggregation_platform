// src/models/analytics.model.js
import mongoose from "mongoose";

const AnalyticsSchema = new mongoose.Schema(
  {
    nodeId: { type: String, required: true, index: true },
    period: { type: String, required: true }, // e.g., "2025-11-07_daily"
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    metrics: { type: Object, required: true }, // aggregated metrics
    metadata: { type: Object },
    generatedAt: { type: Date, default: () => new Date() }
  },
  { timestamps: true }
);

AnalyticsSchema.index({ nodeId: 1, period: 1 }, { unique: true });

export default mongoose.models.Analytics || mongoose.model("Analytics", AnalyticsSchema);
