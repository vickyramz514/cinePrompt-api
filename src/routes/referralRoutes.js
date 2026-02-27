/**
 * Referral routes
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middlewares/auth.js';
import * as referralController from '../controllers/referralController.js';

const router = Router();

const applyLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many referral attempts' } },
});

router.post('/apply', authenticate, applyLimit, referralController.applyReferral);
router.get('/stats', authenticate, referralController.getStats);

export default router;
