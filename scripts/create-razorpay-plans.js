/**
 * Create Razorpay plans and update SubscriptionPlan.razorpayPlanId
 * Run: RAZORPAY_KEY_ID=xxx RAZORPAY_KEY_SECRET=xxx npx node scripts/create-razorpay-plans.js
 */

import { PrismaClient } from '@prisma/client';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const plans = [
  { slug: 'starter', name: 'CinePrompt Starter', amountPaise: 49900 },
  { slug: 'creator', name: 'CinePrompt Creator', amountPaise: 99900 }, // Legacy plan
  { slug: 'ultra', name: 'CinePrompt Ultra', amountPaise: 199900 },
];

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET');
    process.exit(1);
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { slug: plan.slug },
    });
    if (existing?.razorpayPlanId) {
      console.log(`Plan ${plan.slug} already has razorpayPlanId: ${existing.razorpayPlanId}`);
      continue;
    }

    const rzpPlan = await rzp.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: plan.name,
        amount: plan.amountPaise,
        currency: 'INR',
        description: `${plan.name} - monthly subscription`,
      },
    });

    await prisma.subscriptionPlan.update({
      where: { slug: plan.slug },
      data: { razorpayPlanId: rzpPlan.id },
    });
    console.log(`Created Razorpay plan for ${plan.slug}: ${rzpPlan.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
