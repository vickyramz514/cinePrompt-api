/**
 * API route aggregation
 */

import { Router } from 'express';
import authRoutes from './authRoutes.js';
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
        webhook: 'POST /api/payment/webhook (Razorpay)',
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

router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default router;
