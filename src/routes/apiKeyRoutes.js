/**
 * API Keys routes - DataCaptain key for logged-in CinePrompt users
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as apiKeyController from '../controllers/apiKeyController.js';

const router = Router();

router.use(authenticate);

router.get('/me', apiKeyController.getApiKey);
router.post('/regenerate', apiKeyController.regenerateApiKey);

export default router;
