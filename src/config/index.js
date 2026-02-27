/**
 * Centralized configuration for CinePrompt AI Backend
 * All env-based secrets and config values
 */

import dotenv from 'dotenv';

dotenv.config();

const config = {
  // Server
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
  },

  // JWT
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'change-me-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-me-in-production-refresh',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },

  // Credits: 1 credit = 1 second of video
  credits: {
    defaultNewUser: parseInt(process.env.DEFAULT_CREDITS || '30', 10),
    maxResolution: process.env.MAX_RESOLUTION || '720p',
  },

  // Plan limits: max duration per video (seconds) + videos per day
  planLimits: {
    FREE: {
      maxDuration: parseInt(process.env.PLAN_FREE_MAX_DURATION || '5', 10),
      videosPerDay: parseInt(process.env.PLAN_LIMIT_FREE || '1', 10),
    },
    STARTER: {
      maxDuration: parseInt(process.env.PLAN_STARTER_MAX_DURATION || '10', 10),
      videosPerDay: parseInt(process.env.PLAN_LIMIT_STARTER || '2', 10),
    },
    CREATOR: {
      maxDuration: parseInt(process.env.PLAN_CREATOR_MAX_DURATION || '20', 10),
      videosPerDay: parseInt(process.env.PLAN_LIMIT_CREATOR || '4', 10),
    },
    PRO: {
      maxDuration: parseInt(process.env.PLAN_PRO_MAX_DURATION || '20', 10),
      videosPerDay: parseInt(process.env.PLAN_LIMIT_PRO || '4', 10),
    },
    ULTRA: {
      maxDuration: parseInt(process.env.PLAN_ULTRA_MAX_DURATION || '40', 10),
      videosPerDay: parseInt(process.env.PLAN_LIMIT_ULTRA || '6', 10),
    },
  },

  // Abuse prevention
  abuse: {
    maxRequestsPerDay: parseInt(process.env.ABUSE_MAX_REQUESTS_DAY || '10', 10),
    promptSpamWindowMs: parseInt(process.env.PROMPT_SPAM_WINDOW_MS || '60000', 10), // 1 min
    promptSpamThreshold: parseInt(process.env.PROMPT_SPAM_THRESHOLD || '3', 10),
  },

  // API cost (USD per second) - Runway / Replicate
  apiCost: {
    runwayPerSecond: parseFloat(process.env.RUNWAY_COST_PER_SECOND || '0.05'),
    replicatePerSecond: parseFloat(process.env.REPLICATE_COST_PER_SECOND || '0.02'),
  },

  // Razorpay (India)
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  // Runway (primary) - SDK reads RUNWAYML_API_SECRET by default
  runway: {
    apiSecret: process.env.RUNWAY_API_SECRET || process.env.RUNWAYML_API_SECRET,
    model: process.env.RUNWAY_MODEL || 'gen4.5',
    timeoutMs: parseInt(process.env.RUNWAY_TIMEOUT_MS || '600000', 10), // 10 min
    pollIntervalMs: parseInt(process.env.RUNWAY_POLL_INTERVAL_MS || '5000', 10),
    maxRetries: parseInt(process.env.RUNWAY_MAX_RETRIES || '3', 10),
  },

  // Replicate (fallback)
  replicate: {
    apiToken: process.env.REPLICATE_API_TOKEN,
    model: process.env.REPLICATE_VIDEO_MODEL || 'stability-ai/stable-video-diffusion',
    timeoutMs: parseInt(process.env.REPLICATE_TIMEOUT_MS || '300000', 10),
    pollIntervalMs: parseInt(process.env.REPLICATE_POLL_INTERVAL_MS || '5000', 10),
    maxRetries: parseInt(process.env.REPLICATE_MAX_RETRIES || '3', 10),
  },

  // Storage (S3 / Cloudflare R2 compatible)
  storage: {
    provider: process.env.STORAGE_PROVIDER || 's3',
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION || 'auto',
    bucket: process.env.STORAGE_BUCKET || 'cineprompt-videos',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY,
    signedUrlExpiry: parseInt(process.env.SIGNED_URL_EXPIRY || '3600', 10),
    cdnBaseUrl: process.env.CDN_BASE_URL || null, // e.g. https://cdn.example.com
  },

  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    adminMax: parseInt(process.env.RATE_LIMIT_ADMIN_MAX || '60', 10),
  },

  // CORS - comma-separated for multiple origins (e.g. https://cineprompt-ai.vercel.app,http://localhost:3000)
  // When not set in production: allow all origins. Vercel preview URLs (*.vercel.app) always allowed in prod.
  cors: {
    origin: (() => {
      const envOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
        : [];
      const allowed = envOrigins.length > 0 ? envOrigins : ['http://localhost:3000'];
      const allowAllInProd = process.env.NODE_ENV === 'production' && envOrigins.length === 0;
      const isVercelPreview = (origin) =>
        origin && (origin.endsWith('.vercel.app') || origin.includes('.vercel.app'));

      return (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowAllInProd || allowed.includes(origin) || (process.env.NODE_ENV === 'production' && isVercelPreview(origin))) {
          callback(null, origin);
        } else {
          callback(null, false);
        }
      };
    })(),
    credentials: true,
  },
};

export default config;
