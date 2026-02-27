/**
 * Admin Support Controller
 */

import * as supportService from '../services/supportService.js';
import { z } from 'zod';

const messageSchema = z.object({
  message: z.string().min(1).max(5000),
});

export const getTickets = async (req, res, next) => {
  try {
    const { status, priority, limit, offset } = req.query;
    const result = await supportService.getAdminTickets({
      status,
      priority,
      limit: parseInt(limit || '50', 10),
      offset: parseInt(offset || '0', 10),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getTicketById = async (req, res, next) => {
  try {
    const ticket = await supportService.getAdminTicketById(req.params.id);
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const addMessage = async (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new Error('Invalid message');

    const msg = await supportService.addAdminMessage(req.params.id, parsed.data.message);
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
};

export const closeTicket = async (req, res, next) => {
  try {
    const ticket = await supportService.closeTicket(req.params.id);
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};
