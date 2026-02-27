/**
 * Support Controller - user ticket APIs
 */

import * as supportService from '../services/supportService.js';
import { ValidationError } from '../utils/errors.js';
import { z } from 'zod';

const createTicketSchema = z.object({
  subject: z.string().min(3).max(500),
  message: z.string().min(1).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

const messageSchema = z.object({
  message: z.string().min(1).max(5000),
});

export const createTicket = async (req, res, next) => {
  try {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.errors);

    const ticket = await supportService.createTicket(req.user.id, parsed.data);
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const getTickets = async (req, res, next) => {
  try {
    const { status, limit, offset } = req.query;
    const result = await supportService.getMyTickets(req.user.id, {
      status,
      limit: parseInt(limit || '20', 10),
      offset: parseInt(offset || '0', 10),
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const getTicketById = async (req, res, next) => {
  try {
    const ticket = await supportService.getTicketById(req.params.id, req.user.id);
    res.json({ success: true, data: ticket });
  } catch (err) {
    next(err);
  }
};

export const addMessage = async (req, res, next) => {
  try {
    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Validation failed', parsed.error.errors);

    const msg = await supportService.addUserMessage(
      req.params.id,
      req.user.id,
      parsed.data.message
    );
    res.status(201).json({ success: true, data: msg });
  } catch (err) {
    next(err);
  }
};
