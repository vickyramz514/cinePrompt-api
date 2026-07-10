/**
 * Admin API routes
 * All under /api/admin/* - protected by authenticate + adminOnly
 * Rate limited for security
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';
import { authenticate } from '../middlewares/auth.js';
import { adminOnly } from '../middlewares/adminOnly.js';
import * as adminController from '../controllers/adminController.js';
import * as adminSupportController from '../controllers/adminSupportController.js';
import * as growthAnalyticsService from '../services/growthAnalyticsService.js';
import * as investorService from '../services/investorService.js';
import * as referralService from '../services/referralService.js';
import prisma from '../utils/prisma.js';
import { logAdminAction } from '../services/adminAuditService.js';

const router = Router();

// Stricter rate limit for admin APIs
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: config.rateLimit?.adminMax ?? 60,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(authenticate);
router.use(adminOnly);
router.use(adminRateLimit);

// Dashboard
router.get('/dashboard', adminController.getDashboard);
router.get('/dashboard/charts', adminController.getDashboardCharts);

// Users
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserById);
router.post('/users/:id/credit', adminController.updateUserCredit);
router.post('/users/:id/block', adminController.blockUser);
router.post('/users/:id/unblock', adminController.unblockUser);
router.post('/users/:id/plan-override', adminController.planOverride);

// Payments
router.get('/payments', adminController.getPayments);
router.get('/subscriptions', adminController.getSubscriptions);

// Support
router.get('/support/tickets', adminSupportController.getTickets);
router.get('/support/tickets/:id', adminSupportController.getTicketById);
router.post('/support/tickets/:id/message', adminSupportController.addMessage);
router.post('/support/tickets/:id/close', adminSupportController.closeTicket);

// Growth Analytics
router.get('/growth/overview', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const data = await growthAnalyticsService.getGrowthOverview(days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});
router.get('/growth/funnel', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const data = await growthAnalyticsService.getFunnel(days);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Investor Metrics
router.get('/investor/metrics', async (req, res, next) => {
  try {
    const data = await investorService.getInvestorMetrics();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// Affiliate Admin
router.get('/affiliate', async (req, res, next) => {
  try {
    const affiliates = await prisma.affiliate.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        payouts: { where: { status: 'REQUESTED' }, orderBy: { createdAt: 'desc' } },
      },
      orderBy: { totalEarnings: 'desc' },
    });
    res.json({ success: true, data: affiliates });
  } catch (err) {
    next(err);
  }
});
router.post('/affiliate/payout/:id', async (req, res, next) => {
  try {
    const payout = await prisma.affiliatePayout.update({
      where: { id: req.params.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    await logAdminAction(req.user.id, 'affiliate_payout', 'AFFILIATE', req.params.id, {
      amount: payout.amount,
    });
    res.json({ success: true, data: payout });
  } catch (err) {
    next(err);
  }
});

export default router;
