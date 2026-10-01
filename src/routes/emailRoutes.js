/**
 * Public email routes (no auth) — unsubscribe links from marketing emails
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as marketingEmailController from '../controllers/marketingEmailController.js';

const router = Router();

const unsubscribeLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/unsubscribe', unsubscribeLimiter, marketingEmailController.unsubscribe);
router.post('/unsubscribe', unsubscribeLimiter, marketingEmailController.unsubscribe);

export default router;
