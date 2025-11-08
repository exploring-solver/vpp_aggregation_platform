// src/config/db.js
import mongoose from "mongoose";
import env from "./env.js";
import logger from "../utils/logger.js";

export const connectDB = async () => {
  if (!env.MONGO_URI) {
    throw new Error("MONGO_URI not provided in environment");
  }

  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(env.MONGO_URI, {
      // mongoose manages topology & socket by default
    });
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection failed", err);
    throw err;
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB disconnected");
  } catch (err) {
    logger.warn("Error disconnecting MongoDB", err);
  }
};
