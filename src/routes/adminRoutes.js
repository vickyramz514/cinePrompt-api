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

// Jobs
router.get('/jobs', adminController.getJobs);
router.get('/jobs/:id', adminController.getJobById);
router.post('/jobs/:id/cancel', adminController.cancelJob);

// Payments
router.get('/payments', adminController.getPayments);
router.get('/subscriptions', adminController.getSubscriptions);

// Abuse
router.get('/abuse-logs', adminController.getAbuseLogs);

export default router;
