/**
 * Support routes - user ticket APIs
 */

import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as supportController from '../controllers/supportController.js';

const router = Router();
router.use(authenticate);

router.post('/ticket', supportController.createTicket);
router.get('/tickets', supportController.getTickets);
router.get('/tickets/:id', supportController.getTicketById);
router.post('/tickets/:id/message', supportController.addMessage);

export default router;
