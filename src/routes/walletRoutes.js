/**
 * Wallet routes
 * GET  /wallet/balance
 * POST /wallet/add
 */

import { Router } from 'express';
import * as walletController from '../controllers/walletController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);

router.get('/balance', walletController.getBalance);
router.get('/history', walletController.getHistory);
router.post('/add', walletController.addCredits);

export default router;
