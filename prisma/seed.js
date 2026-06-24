import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const subscriptionPlans = [
  { name: 'Free', slug: 'free', description: 'Get started with AI video generation', priceCents: 0, currency: 'INR', credits: 30, creditsPerMonth: 30, billingCycle: null, razorpayPlanId: null, features: ['30 credits (one-time)', '720p output', 'Basic templates'], isActive: true, sortOrder: 0 },
  { name: 'Starter', slug: 'starter', description: 'For developers and small projects', priceCents: 150000, currency: 'INR', credits: 1000, creditsPerMonth: 1000, billingCycle: 'monthly', razorpayPlanId: null, features: ['1,000 requests/day', 'Historical ETF data', 'Email support'], isActive: true, sortOrder: 1 },
  { name: 'Pro', slug: 'pro', description: 'For growing applications', priceCents: 250000, currency: 'INR', credits: 10000, creditsPerMonth: 10000, billingCycle: 'monthly', razorpayPlanId: null, features: ['10,000 requests/day', 'Historical ETF data', 'Higher limits', 'Priority support'], isActive: true, sortOrder: 2 },
  { name: 'Ultra', slug: 'ultra', description: 'For teams and power users', priceCents: 500000, currency: 'INR', credits: 100000, creditsPerMonth: 100000, billingCycle: 'monthly', razorpayPlanId: null, features: ['100,000 requests/day', 'Historical ETF data', 'High-volume production', 'Priority support'], isActive: true, sortOrder: 3 },
  { name: 'Creator', slug: 'creator', description: 'Legacy video plan - deprecated', priceCents: 99900, currency: 'INR', credits: 500, creditsPerMonth: 500, billingCycle: 'monthly', razorpayPlanId: null, features: [], isActive: false, sortOrder: 98 },
];

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@cineprompt.ai' },
    update: {
      role: 'ADMIN',
      password: hashedPassword,
      provider: null,
    },
    create: {
      name: 'Admin User',
      email: 'admin@cineprompt.ai',
      password: hashedPassword,
      credits: 100,
      plan: 'CREATOR',
      role: 'ADMIN',
    },
  });

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  console.log('Seed completed (users + subscription plans)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
