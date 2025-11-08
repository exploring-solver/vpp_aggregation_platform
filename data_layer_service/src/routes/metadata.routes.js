// src/routes/metadata.routes.js
import express from "express";
import * as Controller from "../controllers/metadata.controller.js";

const router = express.Router();

router.put("/", Controller.putMetadata);
router.get("/", Controller.listMetadata);
router.get("/:id", Controller.getMetadata);

export default router;
