import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const subscriptionPlans = [
  { name: 'Free', slug: 'free', description: 'Get started with AI video generation', priceCents: 0, currency: 'INR', credits: 30, creditsPerMonth: 30, billingCycle: null, razorpayPlanId: null, features: ['30 credits (one-time)', '720p output', 'Basic templates'], isActive: true, sortOrder: 0 },
  { name: 'Creator', slug: 'creator', description: 'For casual creators', priceCents: 99900, currency: 'INR', credits: 500, creditsPerMonth: 500, billingCycle: 'monthly', razorpayPlanId: null, features: ['500 credits/month', '1080p output', 'Priority rendering'], isActive: true, sortOrder: 1 },
  { name: 'Starter', slug: 'starter', description: 'For casual creators', priceCents: 49900, currency: 'INR', credits: 500, creditsPerMonth: 500, billingCycle: 'monthly', razorpayPlanId: null, features: ['500 credits/month', '1080p output', 'All templates'], isActive: true, sortOrder: 2 },
  { name: 'Pro', slug: 'pro', description: 'Deprecated - use Creator or Ultra', priceCents: 99900, currency: 'INR', credits: 1500, creditsPerMonth: 1500, billingCycle: 'monthly', razorpayPlanId: null, features: [], isActive: false, sortOrder: 99 },
  { name: 'Ultra', slug: 'ultra', description: 'For teams and power users', priceCents: 199900, currency: 'INR', credits: 4000, creditsPerMonth: 4000, billingCycle: 'monthly', razorpayPlanId: null, features: ['4000 credits/month', '4K output', 'API access'], isActive: true, sortOrder: 3 },
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
