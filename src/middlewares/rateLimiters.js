/**
 * HTTP rate limiters — auth routes get a dedicated budget so login is not
 * blocked by dashboard/API traffic sharing the global IP limit.
 *
 * Production uses Redis so limits stay correct behind Railway's load balancer
 * (multiple replicas). Dev falls back to in-memory unless RATE_LIMIT_REDIS=true.
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const isDev = config.nodeEnv === 'development';
const useRedisStore =
  process.env.RATE_LIMIT_REDIS === 'true' ||
  (config.isProduction && process.env.RATE_LIMIT_REDIS !== 'false');

const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/google',
  '/api/auth/refresh',
  '/v1/auth/login',
  '/v1/auth/signup',
  '/v1/auth/google',
  '/v1/auth/refresh',
]);

export function isAuthRoute(req) {
  return AUTH_PATHS.has(req.path);
}

const rateLimitMessage = (message) => ({
  success: false,
  error: { code: 'RATE_LIMIT', message },
});

function isHealthPath(req) {
  return req.path === '/health' || req.path === '/v1/health' || req.path === '/api/health';
}

function buildLimiters(storeFactory) {
  const authStore = storeFactory ? { store: storeFactory('auth') } : {};
  const apiStore = storeFactory ? { store: storeFactory('api') } : {};

  const auth = rateLimit({
    windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || (isDev ? '200' : '40'), 10),
    standardHeaders: true,
    legacyHeaders: false,
    skip: isHealthPath,
    message: rateLimitMessage('Too many login attempts. Please wait a few minutes and try again.'),
    ...authStore,
  });

  const api = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: parseInt(
      process.env.RATE_LIMIT_MAX || (isDev ? '2000' : String(config.rateLimit.max)),
      10
    ),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => isHealthPath(req) || isAuthRoute(req),
    message: rateLimitMessage('Too many requests, please try again later.'),
    ...apiStore,
  });

  return { auth, api };
}

// Start with in-memory; swap to Redis after init when configured
let { auth: authRateLimiter, api: apiRateLimiter } = buildLimiters(null);

export { authRateLimiter, apiRateLimiter };

/** Prefer Redis store across LB replicas when configured. */
export async function initRateLimitStores() {
  if (!useRedisStore) return;

  const { RedisStore } = await import('rate-limit-redis');
  const { default: redis, ensureRedis } = await import('../utils/redisClient.js');
  await ensureRedis();

  const storeFactory = (prefix) =>
    new RedisStore({
      prefix: `rl:${prefix}:`,
      sendCommand: (...args) => redis.call(...args),
    });

  ({ auth: authRateLimiter, api: apiRateLimiter } = buildLimiters(storeFactory));
}

/** Apply auth or general limiter based on path */
export function applyRateLimit(req, res, next) {
  if (isAuthRoute(req)) {
    return authRateLimiter(req, res, next);
  }
  return apiRateLimiter(req, res, next);
}
