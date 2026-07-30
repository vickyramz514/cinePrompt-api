/**
 * API route aggregation
 * DataCaptain API (auth, wallet, billing, etc.) + market data routes
 */

import { Router } from 'express';
import config from '../config/index.js';
import authRoutes from './authRoutes.js';
import datacaptainRoutes from '../datacaptain/routes/index.js';
import walletRoutes from './walletRoutes.js';
import profileRoutes from './profileRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import paymentRoutes from './paymentRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import adminRoutes from './adminRoutes.js';
import supportRoutes from './supportRoutes.js';
import referralRoutes from './referralRoutes.js';
import affiliateRoutes from './affiliateRoutes.js';
import apiKeyRoutes from './apiKeyRoutes.js';
import usageRoutes from './usageRoutes.js';
import * as statusController from '../controllers/statusController.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'DataCaptain API',
    version: '1.0',
    endpoints: {
      health: 'GET /v1/health',
      auth: {
        signup: 'POST /v1/auth/signup',
        login: 'POST /v1/auth/login',
        google: 'POST /v1/auth/google',
        refresh: 'POST /v1/auth/refresh',
        me: 'GET /v1/auth/me (auth required)',
      },
      wallet: {
        balance: 'GET /v1/wallet/balance (auth required)',
        limits: 'GET /v1/wallet/limits (auth required) - credits + maxDuration',
        history: 'GET /v1/wallet/history (auth required)',
        add: 'POST /v1/wallet/add (auth required)',
      },
      profile: {
        get: 'GET /v1/profile (auth required)',
        update: 'PATCH /v1/profile (auth required)',
      },
      apiKeys: {
        me: 'GET /v1/api-keys/me (auth required)',
        regenerate: 'POST /v1/api-keys/regenerate (auth required)',
      },
      usage: 'GET /v1/usage (auth required)',
      notifications: {
        list: 'GET /v1/notifications (auth required)',
        markRead: 'PATCH /v1/notifications/:id/read (auth required)',
        markAllRead: 'PATCH /v1/notifications/read-all (auth required)',
      },
      subscriptions: {
        plans: 'GET /v1/subscriptions/plans',
        me: 'GET /v1/subscriptions/me (auth required)',
        create: 'POST /v1/subscriptions/create (auth required)',
        cancel: 'POST /v1/subscriptions/cancel (auth required)',
        status: 'GET /v1/subscriptions/status (auth required)',
      },
      payment: {
        createSubscription: 'POST /v1/payment/create-subscription (auth required)',
        webhook: `POST ${config.publicApiUrl}/v1/payment/webhook (Razorpay)`,
      },
      analytics: {
        overview: 'GET /v1/analytics/overview (admin)',
        usageTrends: 'GET /v1/analytics/usage-trends (admin)',
        apiCost: 'GET /v1/analytics/api-cost (admin)',
        topUsers: 'GET /v1/analytics/top-users (admin)',
        profitMetrics: 'GET /v1/analytics/profit-metrics (admin)',
      },
      admin: {
        dashboard: 'GET /v1/admin/dashboard (admin)',
        users: 'GET /v1/admin/users (admin)',
        payments: 'GET /v1/admin/payments (admin)',
      },
    },
  });
});

router.use('/auth', authRoutes);
router.use('/wallet', walletRoutes);
router.use('/profile', profileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/payment', paymentRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/admin', adminRoutes);
router.use('/support', supportRoutes);
router.use('/referral', referralRoutes);
router.use('/affiliate', affiliateRoutes);
router.use('/api-keys', apiKeyRoutes);
router.use('/usage', usageRoutes);

// DataCaptain - market data APIs (x-api-key auth); only for /stocks, /market, /developer, /etf, /options, etc.
const datacaptainPaths = ['/stocks', '/market', '/search', '/screener', '/indicators', '/ai', '/developer', '/etf', '/backtest', '/portfolio', '/options', '/insiders', '/sentiment', '/economy', '/darkpool'];
router.use((req, res, next) => {
  const isDataCaptain = datacaptainPaths.some((p) => req.path === p || req.path.startsWith(p + '/'));
  if (isDataCaptain) return datacaptainRoutes(req, res, next);
  next();
});

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/status', statusController.getStatus);

export default router;
