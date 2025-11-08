// src/config/env.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// load .env from repo root by default
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const REQUIRED = ["MONGO_URI"];

for (const k of REQUIRED) {
  if (!process.env[k]) {
    throw new Error(`REQUIRED env var ${k} is missing!`);
  }
}

const OPTIONAL = ["REDIS_URL", "PORT"];
for (const k of OPTIONAL) {
  if (!process.env[k]) {
    console.warn(`[env] warning: ${k} not set (using default)`);
  }
}

export default {
  MONGO_URI: process.env.MONGO_URI,
  REDIS_URL: process.env.REDIS_URL,
  PORT: process.env.PORT || 4000,
  ETL_CRON: process.env.ETL_CRON || "*/5 * * * *", // default every 5 minutes
  NODE_ENV: process.env.NODE_ENV || "development"
};
