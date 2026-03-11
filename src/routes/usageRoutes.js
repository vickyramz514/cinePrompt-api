/**
 * Usage routes - DataCaptain usage for logged-in CinePrompt users
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as usageController from '../controllers/usageController.js';

const router = Router();

router.use(authenticate);

router.get('/', usageController.getUsage);

export default router;
