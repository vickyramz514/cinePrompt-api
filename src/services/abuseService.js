/**
 * Abuse prevention service
 * - Redis rate limiting
 * - Prompt spam detection
 * - Daily video cap
 * - Concurrent job guard
 */

import Redis from 'ioredis';
import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AbuseError } from '../utils/errors.js';

let redis = null;

const getRedis = () => {
  if (!redis) {
    redis = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => (times < 3 ? 1000 : null),
    });
  }
  return redis;
};

const logAbuse = async (userId, type, meta = {}) => {
  try {
    await prisma.abuseLog.create({
      data: { userId, type, meta },
    });
  } catch (err) {
    logger.warn('Failed to log abuse', { userId, type, error: err.message });
  }
};

/**
 * Check daily request rate (max 10/day)
 */
export const checkDailyRateLimit = async (userId) => {
  const key = `abuse:rate:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const client = getRedis();
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, 86400); // 24h

  if (count > config.abuse.maxRequestsPerDay) {
    await logAbuse(userId, 'RATE_LIMIT', { count, limit: config.abuse.maxRequestsPerDay });
    throw new AbuseError(
      `Daily limit exceeded. Max ${config.abuse.maxRequestsPerDay} requests per day.`,
      'RATE_LIMIT_EXCEEDED'
    );
  }
};

/**
 * Check only 1 active job per user
 */
export const checkConcurrentJob = async (userId) => {
  const active = await prisma.videoJob.count({
    where: {
      userId,
      status: { in: ['PENDING', 'QUEUED', 'PROCESSING'] },
    },
  });

  if (active >= 1) {
    await logAbuse(userId, 'CONCURRENT_JOB', { active });
    throw new AbuseError(
      'Only 1 active video job allowed. Wait for current job to complete.',
      'CONCURRENT_JOB_LIMIT'
    );
  }
};

/**
 * Check prompt spam (same prompt repeated)
 */
export const checkPromptSpam = async (userId, prompt) => {
  const normalized = prompt.trim().toLowerCase().slice(0, 200);
  const windowStart = new Date(Date.now() - config.abuse.promptSpamWindowMs);

  const recent = await prisma.videoJob.count({
    where: {
      userId,
      createdAt: { gte: windowStart },
      prompt: { contains: normalized, mode: 'insensitive' },
    },
  });

  if (recent >= config.abuse.promptSpamThreshold) {
    await logAbuse(userId, 'PROMPT_SPAM', { threshold: config.abuse.promptSpamThreshold });
    throw new AbuseError(
      'Repeated prompts detected. Please try a different prompt.',
      'PROMPT_SPAM'
    );
  }
};

/**
 * Check daily video cap by plan
 * userPlan from User.plan or active subscription
 */
export const checkDailyVideoCap = async (userId, userPlan = 'FREE') => {
  let planKey = userPlan || 'FREE';
  if (planKey === 'FREE') {
    const sub = await prisma.userSubscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: true },
    });
    if (sub?.plan?.slug) {
      planKey = sub.plan.slug.toUpperCase();
    }
  }
  const limit = config.planLimits[planKey] ?? config.planLimits.FREE;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.videoJob.count({
    where: {
      userId,
      createdAt: { gte: today },
      status: { in: ['COMPLETED', 'FAILED', 'CANCELLED'] },
    },
  });

  if (count >= limit) {
    await logAbuse(userId, 'DAILY_CAP', { count, limit, plan: planKey });
    throw new AbuseError(
      `Daily limit reached. ${limit} videos/day for your plan.`,
      'DAILY_CAP_EXCEEDED'
    );
  }
};
