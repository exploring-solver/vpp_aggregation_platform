// src/routes/telemetry.routes.js
import express from "express";
import * as Controller from "../controllers/telemetry.controller.js";

const router = express.Router();

router.post("/", Controller.postTelemetry); // accept single object or array
router.get("/:nodeId", Controller.getTelemetry);

export default router;
