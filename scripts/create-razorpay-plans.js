/**
 * Create Razorpay Plans for each SubscriptionPlan row that is paid + monthly.
 * Updates SubscriptionPlan.razorpayPlanId (plan_xxx).
 *
 * Run: npm run razorpay:create-plans
 * Requires: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET in .env
 *
 * Razorpay account must support the currencies in your DB (e.g. USD for Data Captain plans).
 * If you only have INR enabled, use INR amounts in the DB or create plans in the Razorpay Dashboard.
 */

import { PrismaClient } from '@prisma/client';
import Razorpay from 'razorpay';
import { loadApiEnv } from '../src/config/loadEnv.js';

loadApiEnv();

const prisma = new PrismaClient();

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    process.exit(1);
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  const dbPlans = await prisma.subscriptionPlan.findMany({
    where: {
      isActive: true,
      billingCycle: 'monthly',
      priceCents: { gt: 0 },
    },
    orderBy: { sortOrder: 'asc' },
  });

  if (dbPlans.length === 0) {
    console.log('No paid monthly plans in DB. Run: npm run db:seed:plans');
    return;
  }

  for (const plan of dbPlans) {
    if (plan.razorpayPlanId) {
      console.log(`Skip ${plan.slug}: already linked → ${plan.razorpayPlanId}`);
      continue;
    }

    const currency = (plan.currency || 'INR').toUpperCase();
    const amount = plan.priceCents;

    try {
      const rzpPlan = await rzp.plans.create({
        period: 'monthly',
        interval: 1,
        item: {
          name: plan.name,
          amount,
          currency,
          description: `${plan.name} — monthly (${plan.slug})`,
        },
      });

      await prisma.subscriptionPlan.update({
        where: { slug: plan.slug },
        data: { razorpayPlanId: rzpPlan.id },
      });
      console.log(`OK ${plan.slug}: ${rzpPlan.id} (${currency} ${amount})`);
    } catch (err) {
      console.error(`Failed ${plan.slug} (${currency} ${amount}):`, err?.error?.description || err?.message || err);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
