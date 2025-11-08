// src/controllers/metadata.controller.js
import * as Service from "../services/metadata.service.js";

export const putMetadata = async (req, res) => {
  try {
    const saved = await Service.upsertMetadata(req.body);
    res.json({ success: true, saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getMetadata = async (req, res) => {
  try {
    const id = req.params.id;
    const data = await Service.getMetadata(id);
    if (!data) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const listMetadata = async (req, res) => {
  try {
    const { limit = 100, skip = 0 } = req.query;
    const data = await Service.listMetadata({}, { limit: parseInt(limit), skip: parseInt(skip) });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
