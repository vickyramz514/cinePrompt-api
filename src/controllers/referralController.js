/**
 * Referral Controller - apply code, stats
 */

import * as referralService from '../services/referralService.js';
import { z } from 'zod';

const applySchema = z.object({
  code: z.string().min(1).max(20).optional(),
});

export const applyReferral = async (req, res, next) => {
  try {
    const parsed = applySchema.safeParse(req.body);
    const code = parsed.success ? parsed.data?.code : req.body?.code;

    const result = await referralService.applyReferralCode(
      req.user.id,
      code,
      req.ip
    );
    res.json({ success: true, data: result || { applied: false } });
  } catch (err) {
    next(err);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const stats = await referralService.getReferralStats(req.user.id);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
};
