/**
 * Subscription routes
 * GET  /subscriptions/plans (public)
 * GET  /subscriptions/me (auth required)
 * GET  /subscriptions/status (auth required)
 * POST /subscriptions/create (auth required)
 * POST /subscriptions/cancel (auth required)
 * POST /subscriptions/confirm (auth required)
 */

import { Router } from 'express';
import * as subscriptionController from '../controllers/subscriptionController.js';
import { authenticate, optionalAuth } from '../middlewares/auth.js';

const router = Router();

router.get('/plans', optionalAuth, subscriptionController.listPlans);
router.get('/me', authenticate, subscriptionController.getMySubscription);
router.get('/status', authenticate, subscriptionController.getStatus);
router.post('/create', authenticate, subscriptionController.create);
router.post('/confirm', authenticate, subscriptionController.confirmCheckout);
router.post('/cancel', authenticate, subscriptionController.cancel);

export default router;
