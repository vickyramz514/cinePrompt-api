/**
 * Profile routes
 * GET  /profile
 * PATCH /profile
 */

import { Router } from 'express';
import * as profileController from '../controllers/profileController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', profileController.getProfile);
router.patch('/', profileController.updateProfile);

export default router;
