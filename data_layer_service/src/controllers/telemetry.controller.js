// src/controllers/telemetry.controller.js
import * as Service from "../services/telemetry.service.js";

export const postTelemetry = async (req, res) => {
  try {
    const inserted = await Service.ingest(req.body);
    res.status(201).json({ success: true, insertedCount: inserted.length || (inserted?1:0) });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getTelemetry = async (req, res) => {
  try {
    const nodeId = req.params.nodeId;
    const limit = parseInt(req.query.limit || "100", 10);
    const data = await Service.getRecent(nodeId, { limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
