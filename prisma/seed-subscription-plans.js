/**
 * Seed SubscriptionPlan - Data Captain Stock Data API
 * npx node prisma/seed-subscription-plans.js
 *
 * Plans:
 * - Free: $0, 50 requests/day
 * - Starter: $15/month, 10,000 requests/day
 * - Pro: $39/month, 100,000 requests/day
 * - Enterprise: Custom, high volume
 *
 * Razorpay plan IDs: Create plans in Razorpay Dashboard or via API, then set here.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Get started with stock market data',
    priceCents: 0,
    currency: 'USD',
    credits: 100,
    creditsPerMonth: 100,
    billingCycle: null,
    razorpayPlanId: null,
    features: ['50 requests/day', 'Historical stock data', 'ETF data', 'Basic support'],
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For developers and small projects',
    priceCents: 1500, // $15
    currency: 'USD',
    credits: 10000,
    creditsPerMonth: 10000,
    billingCycle: 'monthly',
    razorpayPlanId: null, // Set after creating plan in Razorpay: plan_xxx
    features: ['10,000 requests/day', 'Historical stock & ETF', 'Email support'],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For growing applications',
    priceCents: 3900, // $39
    currency: 'USD',
    credits: 100000,
    creditsPerMonth: 100000,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: ['100,000 requests/day', 'Historical stock & ETF', 'Options & sentiment', 'Priority support'],
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom high-volume access',
    priceCents: -100, // -1 → Custom pricing
    currency: 'USD',
    credits: -1,
    creditsPerMonth: -1,
    billingCycle: null,
    razorpayPlanId: null,
    features: ['Custom volume', 'Dedicated support', 'SLA'],
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Creator',
    slug: 'creator',
    description: 'Legacy video plan - deprecated',
    priceCents: 99900,
    currency: 'INR',
    credits: 500,
    creditsPerMonth: 500,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: [],
    isActive: false,
    sortOrder: 98,
  },
  {
    name: 'Ultra',
    slug: 'ultra',
    description: 'Legacy video plan - deprecated',
    priceCents: 199900,
    currency: 'INR',
    credits: 4000,
    creditsPerMonth: 4000,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: [],
    isActive: false,
    sortOrder: 99,
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
