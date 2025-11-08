// src/routes/transaction.routes.js
import express from "express";
import * as Controller from "../controllers/transaction.controller.js";

const router = express.Router();

router.post("/", Controller.postTransaction);
router.get("/", Controller.listTransactions);

export default router;
