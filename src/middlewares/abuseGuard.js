/**
 * Abuse Guard Middleware
 * Flow: Platform quota → Concurrent → Prompt spam → (FREE only: daily rate + daily cap)
 * Paid users: no daily limits, only credit-based + platform quota
 */

import prisma from '../utils/prisma.js';
import {
  checkDailyRateLimit,
  checkConcurrentJob,
  checkPromptSpam,
  checkDailyVideoCap,
  checkPlatformDailyQuota,
  isPaidPlan,
} from '../services/abuseService.js';

const resolveEffectivePlan = async (userId, userPlan) => {
  if (userPlan && userPlan !== 'FREE') return userPlan;
  const sub = await prisma.userSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
  });
  if (sub?.plan?.slug) return sub.plan.slug.toUpperCase();
  return 'FREE';
};

/**
 * Middleware: run all abuse checks before video generation
 * Order: platform quota → concurrent → prompt spam → (FREE: rate + daily cap)
 */
export const abuseGuard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const prompt = req.body?.prompt;
    const userPlan = req.user?.plan || 'FREE';
    const effectivePlan = await resolveEffectivePlan(userId, userPlan);
    const paidUser = isPaidPlan(effectivePlan);

    await checkPlatformDailyQuota();
    await checkConcurrentJob(userId);
    if (prompt) await checkPromptSpam(userId, prompt);
    await checkDailyRateLimit(userId, paidUser);
    await checkDailyVideoCap(userId, effectivePlan);

    next();
  } catch (err) {
    next(err);
  }
};
