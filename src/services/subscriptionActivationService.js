/**
 * Apply Razorpay subscription state to User + UserSubscription (webhook + post-checkout confirm).
 */

import prisma from '../utils/prisma.js';
import { logger } from '../utils/logger.js';
import { fetchSubscription } from './razorpayService.js';
import {
  findSubscriptionPlanByRazorpayId,
  mapPlanSlugToUserPlan,
} from '../utils/subscriptionPlanResolver.js';
import { syncApiUserPlanByEmail } from '../utils/syncApiUserPlan.js';

function readUserIdFromNotes(notes) {
  if (!notes || typeof notes !== 'object') return null;
  const raw = notes.user_id ?? notes.userId;
  return raw ? String(raw) : null;
}

function periodDates(subscription) {
  const currentStart = subscription.current_start
    ? new Date(subscription.current_start * 1000)
    : new Date();
  const currentEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return { currentStart, currentEnd };
}

/**
 * @param {object} subscription Razorpay subscription entity
 * @returns {Promise<{ ok: boolean, userId?: string, planSlug?: string, reason?: string }>}
 */
export async function activateSubscriptionFromRazorpayEntity(subscription) {
  if (!subscription?.id) {
    return { ok: false, reason: 'missing_subscription' };
  }

  const plan = await findSubscriptionPlanByRazorpayId(subscription.plan_id);
  if (!plan) {
    return { ok: false, reason: 'plan_not_found', planId: subscription.plan_id };
  }

  const userId = readUserIdFromNotes(subscription.notes);
  if (!userId) {
    return { ok: false, reason: 'missing_user_id' };
  }

  const { currentStart, currentEnd } = periodDates(subscription);
  const razorpaySubId = subscription.id;

  await prisma.$transaction([
    prisma.userSubscription.upsert({
      where: {
        userId_planId: { userId, planId: plan.id },
      },
      create: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        externalId: razorpaySubId,
      },
      update: {
        status: 'ACTIVE',
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        externalId: razorpaySubId,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        plan: mapPlanSlugToUserPlan(plan.slug),
        planExpiresAt: currentEnd,
      },
    }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (user?.email) {
    await syncApiUserPlanByEmail(user.email, plan.slug).catch(() => {});
  }

  logger.info('subscription activated in DB', { userId, planSlug: plan.slug, razorpaySubId });
  return { ok: true, userId, planSlug: plan.slug };
}

/**
 * Confirm checkout: fetch sub from Razorpay and activate for the logged-in user.
 */
export async function confirmSubscriptionForUser(razorpaySubId, expectedUserId) {
  const subscription = await fetchSubscription(razorpaySubId);
  const notesUserId = readUserIdFromNotes(subscription.notes);

  if (notesUserId && notesUserId !== expectedUserId) {
    return { ok: false, reason: 'user_mismatch' };
  }

  const status = String(subscription.status || '').toLowerCase();
  if (!['active', 'authenticated', 'created'].includes(status)) {
    return { ok: false, reason: 'subscription_not_active', status: subscription.status };
  }

  if (!subscription.notes?.user_id) {
    subscription.notes = { ...(subscription.notes || {}), user_id: expectedUserId };
  }

  return activateSubscriptionFromRazorpayEntity(subscription);
}
