/**
 * Affiliate Controller - dashboard, payout
 */

import * as referralService from '../services/referralService.js';
import { z } from 'zod';

const payoutSchema = z.object({
  amount: z.number().positive(),
});

export const getDashboard = async (req, res, next) => {
  try {
    const dashboard = await referralService.getAffiliateDashboard(req.user.id);
    res.json({ success: true, data: dashboard });
  } catch (err) {
    next(err);
  }
};

export const requestPayout = async (req, res, next) => {
  try {
    const parsed = payoutSchema.safeParse(req.body);
    if (!parsed.success) throw new Error('Invalid amount');

    const payout = await referralService.requestPayout(req.user.id, parsed.data.amount);
    res.status(201).json({ success: true, data: payout });
  } catch (err) {
    next(err);
  }
};
