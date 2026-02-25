/**
 * Abuse Guard Middleware
 * Runs before credit check - validates rate limits, concurrent jobs, prompt spam, daily cap
 */

import {
  checkDailyRateLimit,
  checkConcurrentJob,
  checkPromptSpam,
  checkDailyVideoCap,
} from '../services/abuseService.js';

/**
 * Middleware: run all abuse checks before video generation
 */
export const abuseGuard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const prompt = req.body?.prompt;
    const userPlan = req.user?.plan || 'FREE';

    await checkDailyRateLimit(userId);
    await checkConcurrentJob(userId);
    if (prompt) await checkPromptSpam(userId, prompt);
    await checkDailyVideoCap(userId, userPlan);

    next();
  } catch (err) {
    next(err);
  }
};
