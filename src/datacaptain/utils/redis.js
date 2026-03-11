/**
 * Redis client for caching and rate limiting
 */

import Redis from "ioredis";
import config from "../config/index.js";

const redis = new Redis(config.redis.url, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    return Math.min(times * 100, 3000);
  },
});

redis.on("error", (err) => console.error("Redis error:", err));
redis.on("connect", () => console.log("Redis connected"));

export default redis;
