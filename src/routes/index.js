/**
 * API route aggregation
 * CinePrompt (auth, video, wallet, etc.) + DataCaptain (stocks, market data)
 */

import { Router } from 'express';
import config from '../config/index.js';
import authRoutes from './authRoutes.js';
import datacaptainRoutes from '../datacaptain/routes/index.js';
import videoRoutes from './videoRoutes.js';
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

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CinePrompt AI API',
    version: '1.0',
    endpoints: {
      health: 'GET /api/health',
      auth: {
        signup: 'POST /api/auth/signup',
        login: 'POST /api/auth/login',
        google: 'POST /api/auth/google',
        refresh: 'POST /api/auth/refresh',
        me: 'GET /api/auth/me (auth required)',
      },
      video: {
        generate: 'POST /api/video/generate (auth required)',
        history: 'GET /api/video/history (auth required)',
        getById: 'GET /api/video/:id (auth required)',
      },
      wallet: {
        balance: 'GET /api/wallet/balance (auth required)',
        limits: 'GET /api/wallet/limits (auth required) - credits + maxDuration',
        history: 'GET /api/wallet/history (auth required)',
        add: 'POST /api/wallet/add (auth required)',
      },
      profile: {
        get: 'GET /api/profile (auth required)',
        update: 'PATCH /api/profile (auth required)',
      },
      apiKeys: {
        me: 'GET /api/api-keys/me (auth required)',
        regenerate: 'POST /api/api-keys/regenerate (auth required)',
      },
      usage: 'GET /api/usage (auth required)',
      notifications: {
        list: 'GET /api/notifications (auth required)',
        markRead: 'PATCH /api/notifications/:id/read (auth required)',
        markAllRead: 'PATCH /api/notifications/read-all (auth required)',
      },
      subscriptions: {
        plans: 'GET /api/subscriptions/plans',
        me: 'GET /api/subscriptions/me (auth required)',
        create: 'POST /api/subscriptions/create (auth required)',
        cancel: 'POST /api/subscriptions/cancel (auth required)',
        status: 'GET /api/subscriptions/status (auth required)',
      },
      payment: {
        createSubscription: 'POST /api/payment/create-subscription (auth required)',
        webhook: `POST ${config.publicApiUrl}/api/payment/webhook (Razorpay)`,
      },
      analytics: {
        overview: 'GET /api/analytics/overview (admin)',
        usageTrends: 'GET /api/analytics/usage-trends (admin)',
        apiCost: 'GET /api/analytics/api-cost (admin)',
        topUsers: 'GET /api/analytics/top-users (admin)',
        profitMetrics: 'GET /api/analytics/profit-metrics (admin)',
      },
      admin: {
        dashboard: 'GET /api/admin/dashboard (admin)',
        users: 'GET /api/admin/users (admin)',
        jobs: 'GET /api/admin/jobs (admin)',
        payments: 'GET /api/admin/payments (admin)',
        abuseLogs: 'GET /api/admin/abuse-logs (admin)',
      },
    },
  });
});

router.use('/auth', authRoutes);
router.use('/video', videoRoutes);
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

export default router;
