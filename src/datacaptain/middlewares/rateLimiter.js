/**
 * Redis-based rate limiter
 * Free plan: 1000 requests/day per API key
 */

import redis from "../utils/redis.js";
import config from "../config/index.js";
import logger from "../utils/logger.js";

const DAILY_LIMIT = config.rateLimit.daily;
const WINDOW = 86400; // 24 hours in seconds

export async function rateLimiter(req, res, next) {
  const user = req.apiUser;
  if (!user) return next();

  const key = `ratelimit:${user.id}:${new Date().toISOString().slice(0, 10)}`;

  try {
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW);

    const limit = user.daily_limit || DAILY_LIMIT;
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, limit - count));

    if (count > limit) {
      logger.warn(`Rate limit exceeded for user ${user.id}`);
      res.setHeader("X-RateLimit-Limit", limit);
      res.setHeader("X-RateLimit-Remaining", 0);
      return res.status(429).json({
        success: false,
        error: {
          code: "RATE_LIMIT",
          message: "Daily rate limit exceeded. Upgrade your plan for more requests.",
          hint: "Check X-RateLimit-Remaining on responses, or GET /v1/developer/usage",
        },
      });
    }
    next();
  } catch (err) {
    logger.error("Rate limiter error:", err);
    next();
  }
}
