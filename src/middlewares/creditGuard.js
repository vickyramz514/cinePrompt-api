/**
 * Credit Guard Middleware
 * - Validates wallet balance >= required seconds
 * - Creates CreditLock before job creation
 * - Prevents API call if credits insufficient
 */

import prisma from '../utils/prisma.js';
import { getBalance } from '../services/creditService.js';
import { getCreditCost } from '../services/creditService.js';
import { InsufficientCreditsError } from '../utils/errors.js';

const LOCK_STATUS = { LOCKED: 'LOCKED', CONSUMED: 'CONSUMED', RELEASED: 'RELEASED' };

/**
 * Middleware: validate balance and create credit lock
 * Attaches creditLockId to req for use in controller
 */
export const creditGuard = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const requiredSeconds = getCreditCost();

    const balance = await getBalance(userId);
    if (balance < requiredSeconds) {
      throw new InsufficientCreditsError(
        `Insufficient credits. Required: ${requiredSeconds}s, Available: ${balance}s`
      );
    }

    // Lock will be created in controller with jobId - we only validate here
    req.requiredSeconds = requiredSeconds;
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
