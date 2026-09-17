/**
 * Seed SubscriptionPlan - Data Captain Stock Data API
 * npx node prisma/seed-subscription-plans.js
 *
 * Plans:
 * - Free: ₹0, 50 requests/day
 * - Starter: ₹1,500/month, 1,000 requests/day
 * - Pro: ₹2,500/month, 10,000 requests/day
 * - Ultra: ₹5,000/month, 100,000 requests/day
 * - Admin Test: ₹1/month (Razorpay plan_TMjQVr5OqTfKX8) — adminOnly
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
    adminOnly: false,
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
    adminOnly: false,
    sortOrder: 1,
    metadata: {
      offerBadge: 'Launch price',
      compareAtCents: 200000,
      offerNote: 'Introductory monthly rate — unlock history & backtests',
      popular: true,
    },
  },
  {
    name: 'Starter Annual',
    slug: 'starter-annual',
    description: 'Starter billed yearly — 2 months free vs monthly',
    priceCents: 1500000, // ₹15,000 / year (= 10 × ₹1,500)
    currency: 'INR',
    credits: 1000,
    creditsPerMonth: 1000,
    billingCycle: 'yearly',
    razorpayPlanId: 'plan_Td0xEpRepdFo7Z',
    features: [
      'Everything in Starter',
      'Billed annually',
      'Save ₹3,000 vs 12× monthly',
      '1,000 requests/day',
    ],
    isActive: true,
    adminOnly: false,
    sortOrder: 2,
    metadata: {
      offerBadge: 'Save ₹3,000/yr',
      compareAtCents: 1800000,
      offerNote: '2 months free compared with monthly Starter',
      popular: false,
    },
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
    adminOnly: false,
    sortOrder: 3,
    metadata: {
      offerBadge: null,
      popular: false,
    },
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
    adminOnly: false,
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
    adminOnly: false,
    sortOrder: 4,
  },
  {
    name: 'Admin Test',
    slug: 'admin-test',
    description: 'Internal ₹1 Razorpay test plan — visible to admins only',
    priceCents: 100, // ₹1 (matches Razorpay plan_TMjQVr5OqTfKX8)
    currency: 'INR',
    credits: 1000,
    creditsPerMonth: 1000,
    billingCycle: 'monthly',
    razorpayPlanId: 'plan_TMjQVr5OqTfKX8',
    features: [
      'Admin-only checkout test',
      '₹1 / month (Razorpay live test plan)',
      'Starter-level API entitlements',
      '1,000 requests/day',
    ],
    isActive: true,
    adminOnly: true,
    sortOrder: 90,
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
    adminOnly: false,
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
