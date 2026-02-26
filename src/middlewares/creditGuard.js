/**
 * Credit Guard Middleware
 * - Validates requested duration <= plan maxDuration
 * - Validates wallet balance >= required seconds (1 credit = 1 second)
 * - Attaches requiredSeconds to req for controller
 */

import prisma from '../utils/prisma.js';
import { getBalance, getMaxDuration } from '../services/creditService.js';
import { InsufficientCreditsError, ValidationError } from '../utils/errors.js';

const LOCK_STATUS = { LOCKED: 'LOCKED', CONSUMED: 'CONSUMED', RELEASED: 'RELEASED' };

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
 * Middleware: validate duration + balance, attach requiredSeconds
 * Reads durationSeconds or duration from req.body (default 5)
 */
export const creditGuard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const requestedSeconds = Math.floor(
      Number(req.body?.durationSeconds ?? req.body?.duration ?? 5) || 5
    );
    if (requestedSeconds < 1 || requestedSeconds > 60) {
      throw new ValidationError('durationSeconds must be between 1 and 60');
    }

    const userPlan = req.user?.plan || 'FREE';
    const effectivePlan = await resolveEffectivePlan(userId, userPlan);
    const maxDuration = getMaxDuration(effectivePlan);
    if (requestedSeconds > maxDuration) {
      throw new ValidationError(
        `Max duration allowed for your plan is ${maxDuration} seconds`
      );
    }

    const balance = await getBalance(userId);
    if (balance < requestedSeconds) {
      throw new InsufficientCreditsError(
        `Insufficient credits. Required: ${requestedSeconds}, available: ${balance}`
      );
    }

    req.requiredSeconds = requestedSeconds;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Create credit lock (call from controller after job created)
 */
export const createCreditLock = async (userId, jobId, seconds) => {
  return prisma.creditLock.create({
    data: {
      userId,
      jobId,
      seconds,
      status: LOCK_STATUS.LOCKED,
    },
  });
};

/**
 * Consume lock and deduct credits (call from worker on success)
 */
export const consumeCreditLock = async (jobId) => {
  return prisma.$transaction(async (tx) => {
    const lock = await tx.creditLock.findUnique({
      where: { jobId },
    });
    if (!lock || lock.status !== LOCK_STATUS.LOCKED) {
      return null;
    }

    const { deductForVideoJob } = await import('../services/creditService.js');
    await deductForVideoJob(lock.userId, jobId, lock.seconds);

    await tx.creditLock.update({
      where: { id: lock.id },
      data: { status: LOCK_STATUS.CONSUMED },
    });

    return lock;
  });
};

/**
 * Release lock (call from worker on failure - no deduction)
 */
export const releaseCreditLock = async (jobId) => {
  return prisma.creditLock.updateMany({
    where: { jobId, status: LOCK_STATUS.LOCKED },
    data: { status: LOCK_STATUS.RELEASED },
  });
};

export { LOCK_STATUS };
