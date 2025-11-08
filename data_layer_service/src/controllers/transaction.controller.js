// src/controllers/transaction.controller.js
import * as Service from "../services/transaction.service.js";

export const postTransaction = async (req, res) => {
  try {
    const saved = await Service.createTransaction(req.body);
    res.status(201).json({ success: true, saved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const listTransactions = async (req, res) => {
  try {
    const q = {
      type: req.query.type,
      from: req.query.from ? new Date(req.query.from) : undefined,
      to: req.query.to ? new Date(req.query.to) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100
    };
    const rows = await Service.listTransactions(q);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
