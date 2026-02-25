import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  await prisma.user.upsert({
    where: { email: 'admin@cineprompt.ai' },
    update: {},
    create: {
      name: 'Admin User',
      email: 'admin@cineprompt.ai',
      password: hashedPassword,
      credits: 100,
      plan: 'CREATOR',
    },
  });

  console.log('Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
