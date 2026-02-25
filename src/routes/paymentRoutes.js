/**
 * Payment routes
 * POST /payment/create-subscription (auth) - create Razorpay checkout
 * POST /payment/webhook - Razorpay webhook (no auth, handled in server.js with raw body)
 */

import { Router } from 'express';
import * as paymentController from '../controllers/paymentController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.post('/create-subscription', authenticate, paymentController.createSubscriptionCheckout);
// Webhook is mounted in server.js with raw body middleware

export default router;
