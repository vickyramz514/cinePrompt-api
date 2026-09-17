/**
 * Link Razorpay plan IDs to SubscriptionPlan.
 * Source priority:
 * 1) JSON map file by mode (scripts/razorpay-plans.test.json or .live.json)
 * 2) Environment variables fallback (RAZORPAY_PLAN_*)
 *
 * Legacy: RAZORPAY_PLAN_CREATOR, RAZORPAY_PLAN_ULTRA
 */

import { PrismaClient } from '@prisma/client';
import { loadApiEnv } from '../src/config/loadEnv.js';
import { loadPlanMap } from './razorpay-plan-map.js';

loadApiEnv();

const prisma = new PrismaClient();

const planVars = [
  { slug: 'starter', envKey: 'RAZORPAY_PLAN_STARTER' },
  { slug: 'starter-annual', envKey: 'RAZORPAY_PLAN_STARTER_ANNUAL' },
  { slug: 'pro', envKey: 'RAZORPAY_PLAN_PRO' },
  { slug: 'ultra', envKey: 'RAZORPAY_PLAN_ULTRA' },
  { slug: 'admin-test', envKey: 'RAZORPAY_PLAN_ADMIN_TEST' },
  // legacy fallback mapping
  { slug: 'creator', envKey: 'RAZORPAY_PLAN_CREATOR' },
];

async function main() {
  const { mode, file, map } = loadPlanMap();
  console.log(`Using Razorpay plan map: ${file} (mode=${mode})`);

  for (const { slug, envKey } of planVars) {
    const planId = map?.[slug] || process.env[envKey];
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
