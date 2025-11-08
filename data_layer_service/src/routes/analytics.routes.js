// src/routes/analytics.routes.js
import express from "express";
import * as Controller from "../controllers/analytics.controller.js";

const router = express.Router();

router.post("/run", Controller.runETL); // manual trigger for whole system window
router.post("/run/:nodeId", Controller.runETLForNode); // manual per-node trigger

export default router;
