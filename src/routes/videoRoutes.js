/**
 * Video routes
 * POST  /video/generate
 * GET   /video/status/:jobId  - Live job progress
 * GET   /video/history
 * GET   /video/:id
 */

import { Router } from 'express';
import * as videoController from '../controllers/videoController.js';
import { authenticate } from '../middlewares/auth.js';
import { abuseGuard } from '../middlewares/abuseGuard.js';
import { creditGuard } from '../middlewares/creditGuard.js';

const router = Router();

router.use(authenticate);

router.post('/generate', abuseGuard, creditGuard, videoController.generate);
router.get('/status/:jobId', (req, res, next) => {
  req.params.id = req.params.jobId;
  return videoController.getById(req, res, next);
});
router.get('/history', videoController.history);
router.get('/:id', videoController.getById);

export default router;
