/**
 * Promote a user to ADMIN for testing analytics
 * Run: npx node scripts/make-admin.js user@email.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx node scripts/make-admin.js user@email.com');
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
  });
  console.log(`Promoted ${user.email} to ADMIN`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
