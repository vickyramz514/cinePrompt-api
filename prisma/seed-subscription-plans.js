/**
 * Seed SubscriptionPlan - run after main seed
 * npx node prisma/seed-subscription-plans.js
 *
 * Plans (per spec):
 * - Free: 30 credits (one-time)
 * - Starter: ₹499/month → 500 credits
 * - Creator: ₹999/month → 500 credits
 * - Ultra: ₹1999/month → 4000 credits
 *
 * Razorpay plan IDs: Create plans in Razorpay Dashboard or via API, then set here.
 * For paid plans, razorpayPlanId must match a plan created in Razorpay.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Get started with AI video generation',
    priceCents: 0,
    currency: 'INR',
    credits: 30,
    creditsPerMonth: 30,
    billingCycle: null,
    razorpayPlanId: null,
    features: ['30 credits (one-time)', '720p output', 'Basic templates'],
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Creator',
    slug: 'creator',
    description: 'For casual creators',
    priceCents: 99900, // ₹999
    currency: 'INR',
    credits: 500,
    creditsPerMonth: 500,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: ['500 credits/month', '1080p output', 'Priority rendering'],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For casual creators',
    priceCents: 49900, // ₹499
    currency: 'INR',
    credits: 500,
    creditsPerMonth: 500,
    billingCycle: 'monthly',
    razorpayPlanId: null, // Set after creating plan in Razorpay: plan_xxx
    features: ['500 credits/month', '1080p output', 'All templates'],
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Deprecated - use Creator or Ultra',
    priceCents: 99900,
    currency: 'INR',
    credits: 1500,
    creditsPerMonth: 1500,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: [],
    isActive: false, // Removed from subscriptions
    sortOrder: 99,
  },
  {
    name: 'Ultra',
    slug: 'ultra',
    description: 'For teams and power users',
    priceCents: 199900, // ₹1999
    currency: 'INR',
    credits: 4000,
    creditsPerMonth: 4000,
    billingCycle: 'monthly',
    razorpayPlanId: null, // Set after creating plan in Razorpay: plan_xxx
    features: ['4000 credits/month', '4K output', 'API access'],
    isActive: true,
    sortOrder: 3,
  },
];

async function main() {
  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }
  console.log('Subscription plans seeded');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
