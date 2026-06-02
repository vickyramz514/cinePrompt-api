/**
 * CinePrompt AI - Production Backend Server
 * Express + Prisma + Redis + BullMQ + DataCaptain (market data + WebSocket)
 */

import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index.js';
import { applyRateLimit } from './middlewares/rateLimiters.js';
import routes from './routes/index.js';
import * as paymentController from './controllers/paymentController.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { logger } from './utils/logger.js';
import { logRazorpayStartupHints } from './utils/razorpayEnvLog.js';
import { runStartupChecks } from './utils/startupChecks.js';
import { sequelize } from './datacaptain/models/index.js';
import { attachWebSocket } from './datacaptain/ws/priceStream.js';

const app = express();
const server = http.createServer(app);

// CORS preflight: handle OPTIONS first so all origins get proper headers (incl. Vercel preview URLs)
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const allowAllInProd = process.env.NODE_ENV === 'production' && envOrigins.length === 0;
  const isVercelPreview = origin && (origin.endsWith('.vercel.app') || origin.includes('.vercel.app'));
  const allowed = envOrigins.length > 0 ? envOrigins : ['http://localhost:3000'];
  const shouldAllow = !origin || allowAllInProd || allowed.includes(origin) || (process.env.NODE_ENV === 'production' && isVercelPreview);

  if (origin && shouldAllow) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.status(204).end();
});

// CORS header normalization: if Access-Control-Allow-Origin gets a comma-separated value
app.use((req, res, next) => {
  const envOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const allowAllInProd = process.env.NODE_ENV === 'production' && envOrigins.length === 0;
  const allowed = envOrigins.length > 0 ? envOrigins : ['http://localhost:3000'];

  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = function (name, value) {
    if (name.toLowerCase() === 'access-control-allow-origin' && typeof value === 'string' && value.includes(',')) {
      const origins = value.split(',').map((o) => o.trim()).filter(Boolean);
      value = (allowAllInProd && req.headers.origin) || allowed.includes(req.headers.origin)
        ? req.headers.origin
        : origins[0] || allowed[0];
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

// Rate limiting (auth routes have their own budget — see middlewares/rateLimiters.js)
app.use(applyRateLimit);

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

// DataCaptain API docs (Swagger)
import swaggerUi from 'swagger-ui-express';
import datacaptainSwagger from './datacaptain/config/swagger.js';
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(datacaptainSwagger, { swaggerOptions: { persistAuthorization: true } }));

// Routes
app.use('/api', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
});

// Error handler
app.use(errorHandler);

// Start server (http for WebSocket support)
async function start() {
  try {
    await sequelize.authenticate();
    logger.info('DataCaptain database connected');
  } catch (err) {
    logger.warn('DataCaptain DB not ready (run datacaptain:db:migrate)', err?.message);
  }
  attachWebSocket(server);
  server.listen(config.port, () => {
    logger.info('Server started', { port: config.port, env: config.nodeEnv });
    logRazorpayStartupHints();
    logger.info('DataCaptain WebSocket: ws://localhost:' + config.port + '/ws');
    runStartupChecks().catch((err) => logger.warn('Startup checks failed', { message: err.message }));
  });
}
start();
