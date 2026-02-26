/**
 * CinePrompt AI - Production Backend Server
 * Express + Prisma + Redis + BullMQ
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import config from './config/index.js';
import routes from './routes/index.js';
import * as paymentController from './controllers/paymentController.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { logger } from './utils/logger.js';

const app = express();

// CORS header normalization: if Access-Control-Allow-Origin gets a comma-separated value
// (e.g. from misconfiguration), use only the matching origin to avoid "multiple values" error
app.use((req, res, next) => {
  const allowed = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : ['http://localhost:3000'];
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = function (name, value) {
    if (name.toLowerCase() === 'access-control-allow-origin' && typeof value === 'string' && value.includes(',')) {
      const origins = value.split(',').map((o) => o.trim()).filter(Boolean);
      value = allowed.includes(req.headers.origin) ? req.headers.origin : origins[0] || allowed[0];
    }
    return origSetHeader(name, value);
  };
  next();
});

// Security
app.use(helmet());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  })
);

// Rate limiting
app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// Webhook: raw body required for Razorpay signature (must run before express.json)
app.use(
  '/api/payment/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body && Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    next();
  },
  paymentController.handleWebhook
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger);

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info('Server started', {
    port: config.port,
    env: config.nodeEnv,
  });
});
