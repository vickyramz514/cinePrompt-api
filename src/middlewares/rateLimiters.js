/**
 * HTTP rate limiters — auth routes get a dedicated budget so login is not
 * blocked by dashboard/API traffic sharing the global IP limit.
 */

import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

const isDev = config.nodeEnv === 'development';

const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/google',
  '/api/auth/refresh',
]);

export function isAuthRoute(req) {
  return AUTH_PATHS.has(req.path);
}

const rateLimitMessage = (message) => ({
  success: false,
  error: { code: 'RATE_LIMIT', message },
});

/** Login / signup / Google / refresh — separate from general API traffic */
export const authRateLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || (isDev ? '200' : '40'), 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many login attempts. Please wait a few minutes and try again.'),
});

/** General API — skips auth paths (they use authRateLimiter) */
export const apiRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: parseInt(
    process.env.RATE_LIMIT_MAX || (isDev ? '2000' : String(config.rateLimit.max)),
    10
  ),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isAuthRoute(req),
  message: rateLimitMessage('Too many requests, please try again later.'),
});

/** Apply auth or general limiter based on path */
export function applyRateLimit(req, res, next) {
  if (isAuthRoute(req)) {
    return authRateLimiter(req, res, next);
  }
  return apiRateLimiter(req, res, next);
}
