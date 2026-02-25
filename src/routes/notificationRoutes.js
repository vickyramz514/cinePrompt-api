/**
 * Notification routes
 * GET   /notifications
 * PATCH /notifications/:id/read
 * PATCH /notifications/read-all
 */

import { Router } from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authenticate } from '../middlewares/auth.js';

const router = Router();

router.use(authenticate);
router.get('/', notificationController.list);
router.patch('/read-all', notificationController.markAllRead); // Must be before :id
router.patch('/:id/read', notificationController.markRead);

export default router;
