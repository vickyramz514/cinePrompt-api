/**
 * Affiliate routes
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as affiliateController from '../controllers/affiliateController.js';

const router = Router();
router.use(authenticate);

router.get('/dashboard', affiliateController.getDashboard);
router.post('/payout-request', affiliateController.requestPayout);

export default router;
