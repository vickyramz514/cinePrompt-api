/**
 * Seed SubscriptionPlan - Data Captain Stock Data API
 * npx node prisma/seed-subscription-plans.js
 *
 * Plans:
 * - Free: $0, 50 requests/day
 * - Starter: ₹1,500/month, 1,000 requests/day
 * - Pro: ₹2,500/month, 10,000 requests/day
 * - Ultra: ₹5,000/month, 100,000 requests/day
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
    currency: 'INR',
    credits: 50,
    creditsPerMonth: 50,
    billingCycle: null,
    razorpayPlanId: null,
    features: ['50 requests/day', 'ETF list & batch prices', 'Market status', 'Basic support'],
    isActive: true,
    sortOrder: 0,
  },
  {
    name: 'Starter',
    slug: 'starter',
    description: 'For developers and small projects',
    priceCents: 150000, // ₹1,500
    currency: 'INR',
    credits: 1000,
    creditsPerMonth: 1000,
    billingCycle: 'monthly',
    razorpayPlanId: null, // Set after creating plan in Razorpay: plan_xxx
    features: ['1,000 requests/day', 'Historical ETF data', 'Backtesting', 'Email support'],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'For growing applications',
    priceCents: 250000, // ₹2,500
    currency: 'INR',
    credits: 10000,
    creditsPerMonth: 10000,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: ['10,000 requests/day', 'Historical ETF data', 'Higher limits', 'Priority support'],
    isActive: true,
    sortOrder: 2,
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
    description: 'For high-volume production usage',
    priceCents: 500000,
    currency: 'INR',
    credits: 100000,
    creditsPerMonth: 100000,
    billingCycle: 'monthly',
    razorpayPlanId: null,
    features: ['100,000 requests/day', 'Historical ETF data', 'High-volume production', 'Priority support'],
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Custom high-volume access (legacy, hidden)',
    priceCents: -100, // -1 → Custom pricing
    currency: 'INR',
    credits: -1,
    creditsPerMonth: -1,
    billingCycle: null,
    razorpayPlanId: null,
    features: ['Custom volume', 'Dedicated support', 'SLA'],
    isActive: false,
    sortOrder: 100,
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
