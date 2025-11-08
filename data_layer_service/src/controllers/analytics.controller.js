// src/controllers/analytics.controller.js
import * as Service from "../services/analytics.service.js";

export const runETLForNode = async (req, res) => {
  try {
    const nodeId = req.params.nodeId || null;
    const start = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 5 * 60 * 1000); // last 5 min default
    const end = req.query.end ? new Date(req.query.end) : new Date();
    const doc = await Service.runAggregationForNode(nodeId, start, end);
    res.json({ success: true, doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const runETL = async (req, res) => {
  try {
    const doc = await Service.runScheduledETL({ windowMinutes: parseInt(req.query.windowMinutes || "5") });
    res.json({ success: true, doc });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
