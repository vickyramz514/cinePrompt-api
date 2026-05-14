/**
 * Check each SubscriptionPlan.razorpayPlanId against Razorpay (same keys as the server).
 * Use this when Razorpay returns "The ID provided is invalid or could not be found."
 *
 * From cinePrompt-api: npm run razorpay:verify-plans
 */

import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

async function main() {
  if (!keyId || !keySecret) {
    console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (same as your running API).');
    process.exit(1);
  }

  const modeHint =
    keyId.startsWith('rzp_live_') ? 'live' : keyId.startsWith('rzp_test_') ? 'test' : 'unknown';
  console.log(`Using Razorpay keys: mode looks like **${modeHint}** (from key_id prefix)\n`);

  const prisma = new PrismaClient();
  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  const plans = await prisma.subscriptionPlan.findMany({
    where: { razorpayPlanId: { not: null } },
    select: { slug: true, name: true, razorpayPlanId: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (!plans.length) {
    console.log('No plans have razorpayPlanId set. Run razorpay:create-plans or razorpay:link-plans.');
    await prisma.$disconnect();
    return;
  }

  for (const p of plans) {
    const id = p.razorpayPlanId;
    try {
      const entity = await rzp.plans.fetch(id);
      const amount = entity?.item?.amount;
      const cur = entity?.item?.currency;
      console.log(`OK   ${p.slug.padEnd(10)} ${id}  (${entity?.item?.name ?? '—'} ${amount ?? ''} ${cur ?? ''})`);
    } catch (err) {
      const desc = err?.error?.description || err?.description || err?.message || String(err);
      console.log(`FAIL ${p.slug.padEnd(10)} ${id}`);
      console.log(`     → ${desc}`);
    }
  }

  console.log(
    '\nIf any row is FAIL: open Razorpay Dashboard (same test/live mode as key_id), Subscriptions → Plans, copy the plan id, then:'
  );
  console.log('  RAZORPAY_PLAN_STARTER=plan_xxx ... npm run razorpay:link-plans');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
