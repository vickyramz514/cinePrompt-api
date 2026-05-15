/**
 * Link Razorpay plan IDs to SubscriptionPlan (when plans created manually in Dashboard)
 * Run: RAZORPAY_PLAN_STARTER=plan_xxx RAZORPAY_PLAN_PRO=plan_yyy npm run razorpay:link-plans
 *
 * Legacy: RAZORPAY_PLAN_CREATOR, RAZORPAY_PLAN_ULTRA
 */

import { PrismaClient } from '@prisma/client';
import { loadApiEnv } from '../src/config/loadEnv.js';

loadApiEnv();

const prisma = new PrismaClient();

const planVars = [
  { slug: 'starter', envKey: 'RAZORPAY_PLAN_STARTER' },
  { slug: 'pro', envKey: 'RAZORPAY_PLAN_PRO' },
  { slug: 'creator', envKey: 'RAZORPAY_PLAN_CREATOR' },
  { slug: 'ultra', envKey: 'RAZORPAY_PLAN_ULTRA' },
];

async function main() {
  for (const { slug, envKey } of planVars) {
    const planId = process.env[envKey];
    if (!planId) continue;

    const updated = await prisma.subscriptionPlan.updateMany({
      where: { slug },
      data: { razorpayPlanId: planId },
    });
    if (updated.count > 0) {
      console.log(`Linked ${slug} → ${planId}`);
    } else {
      console.log(`Plan ${slug} not found in DB, skipping`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
