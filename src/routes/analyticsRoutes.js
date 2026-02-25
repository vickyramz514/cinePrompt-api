/**
 * Analytics routes - Admin only
 */

import { Router } from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

router.get('/overview', analyticsController.getOverview);
router.get('/usage-trends', analyticsController.getUsageTrends);
router.get('/api-cost', analyticsController.getApiCost);
router.get('/top-users', analyticsController.getTopUsers);
router.get('/profit-metrics', analyticsController.getProfitMetrics);

export default router;
