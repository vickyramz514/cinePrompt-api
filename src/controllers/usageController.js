/**
 * Usage controller - Returns DataCaptain usage for logged-in user
 * GET /usage - JWT required, bridges to DataCaptain developer usage
 */

import { ApiUser, ApiKey } from '../datacaptain/models/index.js';
import * as developerUsageService from '../datacaptain/services/developerUsageService.js';
import { syncApiUserPlanFromUser } from '../utils/syncApiUserPlan.js';
import { dailyLimitForPlan } from '../datacaptain/config/planAccess.js';

/**
 * GET /usage - Return usage stats for user's DataCaptain API key
 */
export async function getUsage(req, res, next) {
  try {
    const { enrichUserWithEffectivePlan } = await import('../utils/userPlanEnrichment.js');
    const user = await enrichUserWithEffectivePlan(req.user);
    const { email } = user;
    if (!email) {
      return res.status(400).json({ success: false, error: { message: 'User email required' } });
    }

    await syncApiUserPlanFromUser({ email, plan: user?.plan });

    const apiUser = await ApiUser.findOne({ where: { email } });
    if (!apiUser) {
      const planSlug = (user?.plan && String(user.plan).toLowerCase()) || 'free';
      const dailyLimit = dailyLimitForPlan(planSlug);
      return res.json({
        success: true,
        data: {
          requestsToday: 0,
          requestsThisMonth: 0,
          dailyLimit,
          monthlyLimit: 10000,
          remainingToday: dailyLimit,
          remainingThisMonth: 10000,
          plan: planSlug,
        },
      });
    }

    const apiKey = await ApiKey.findOne({
      where: { user_id: apiUser.id, is_active: true },
    });

    if (!apiKey) {
      const dailyLimit = apiUser.daily_limit ?? dailyLimitForPlan(apiUser.plan || 'free');
      return res.json({
        success: true,
        data: {
          requestsToday: 0,
          requestsThisMonth: 0,
          dailyLimit,
          monthlyLimit: 10000,
          remainingToday: dailyLimit,
          remainingThisMonth: 10000,
          plan: apiUser.plan || 'free',
        },
      });
    }

    const dailyLimit = apiUser.daily_limit ?? dailyLimitForPlan(apiUser.plan || 'free');
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
