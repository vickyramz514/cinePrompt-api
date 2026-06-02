/**
 * Usage controller - Returns DataCaptain usage for logged-in user
 * GET /usage - JWT required, bridges to DataCaptain developer usage
 */

import { ApiUser, ApiKey } from '../datacaptain/models/index.js';
import * as developerUsageService from '../datacaptain/services/developerUsageService.js';

/**
 * GET /usage - Return usage stats for user's DataCaptain API key
 */
export async function getUsage(req, res, next) {
  try {
    const { email } = req.user;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'User email required' } });
    }

    const apiUser = await ApiUser.findOne({ where: { email } });
    if (!apiUser) {
      return res.json({
        success: true,
        data: {
          requestsToday: 0,
          requestsThisMonth: 0,
          dailyLimit: 1000,
          monthlyLimit: 10000,
          remainingToday: 1000,
          remainingThisMonth: 10000,
          plan: apiUser.plan || 'free',
        },
      });
    }

    const apiKey = await ApiKey.findOne({
      where: { user_id: apiUser.id, is_active: true },
    });

    if (!apiKey) {
      return res.json({
        success: true,
        data: {
          requestsToday: 0,
          requestsThisMonth: 0,
          dailyLimit: 1000,
          monthlyLimit: 10000,
          remainingToday: 1000,
          remainingThisMonth: 10000,
          plan: apiUser.plan || 'free',
        },
      });
    }

    const dailyLimit = apiUser.daily_limit ?? 1000;
    const stats = await developerUsageService.getUsageStats(apiKey.id, dailyLimit);

    const monthlyLimit = 10000;
    const requestsThisMonth = 0;
    const remainingThisMonth = Math.max(0, monthlyLimit - requestsThisMonth);

    res.json({
      success: true,
      data: {
        requestsToday: stats.requestsToday,
        requestsThisMonth,
        dailyLimit,
        monthlyLimit,
        remainingToday: stats.requestsRemaining,
        remainingThisMonth,
        plan: apiUser.plan || stats.plan || 'free',
      },
    });
  } catch (err) {
    next(err);
  }
}
