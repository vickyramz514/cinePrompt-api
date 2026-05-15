/**
 * DataCaptain API - Configuration (merged into cinePrompt)
 * Uses shared DATABASE_URL and REDIS_URL from env
 */

import { loadApiEnv } from "../../config/loadEnv.js";

loadApiEnv();

const config = {
  env: process.env.NODE_ENV || "development",

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "datacaptain-secret-change-me",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  },

  rateLimit: {
    daily: parseInt(process.env.RATE_LIMIT_DAILY || "1000", 10),
  },

  cache: {
    ttl: parseInt(process.env.CACHE_TTL || "60", 10),
  },
};

export default config;
