/**
 * Manually sync a user's plan from Razorpay subscription to database.
 * Use when webhook didn't run (e.g. localhost) or to fix stale data.
 *
 * Get subscription ID from Razorpay Dashboard → Subscriptions → copy sub_xxx
 * Run: RAZORPAY_SUB_ID=sub_xxxxx node scripts/sync-subscription-from-razorpay.js
 */

import '../src/config/ensureEnv.js';
import prisma from '../src/utils/prisma.js';
import { fetchSubscription } from '../src/services/razorpayService.js';

async function main() {
  const razorpaySubId = process.env.RAZORPAY_SUB_ID;

  if (!razorpaySubId) {
    console.error('Set RAZORPAY_SUB_ID (from Razorpay Dashboard → Subscriptions)');
    process.exit(1);
  }

  const rzpSub = await fetchSubscription(razorpaySubId);
  const planId = rzpSub.plan_id;
  const notes = rzpSub.notes || {};
  const userId = notes.user_id;

  if (!userId) {
    console.error('Subscription has no user_id in notes. Was it created via our API?');
    console.error('Notes:', notes);
    process.exit(1);
  }

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { razorpayPlanId: planId },
  });
  if (!plan) {
    console.error('Plan not found for razorpayPlanId:', planId);
    process.exit(1);
  }

  const currentStart = rzpSub.current_start
    ? new Date(rzpSub.current_start * 1000)
    : new Date();
  const currentEnd = rzpSub.current_end
    ? new Date(rzpSub.current_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const planMap = { free: 'FREE', starter: 'STARTER', creator: 'CREATOR', pro: 'PRO', ultra: 'ULTRA' };
  const userPlan = planMap[plan.slug?.toLowerCase()] || 'FREE';

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
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { plan: userPlan, planExpiresAt: currentEnd },
    }),
  ]);

  console.log('Synced:', { userId, plan: plan.slug, userPlan, currentEnd });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
