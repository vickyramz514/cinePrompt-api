/**
 * Auth routes
 * POST /auth/signup
 * POST /auth/login
 * POST /auth/google
 * POST /auth/refresh
 * GET  /auth/me (protected)
 */

import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/google', authController.google);
router.post('/refresh', authController.refresh);
router.get('/me', authenticate, authController.me);

export default router;
