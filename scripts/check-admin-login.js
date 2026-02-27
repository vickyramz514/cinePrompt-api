/**
 * Diagnostic: Check admin user and test password
 * Run: node scripts/check-admin-login.js
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@cineprompt.ai';
  const password = 'password123';

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    console.log('❌ User not found:', email);
    return;
  }

  console.log('User found:', {
    id: user.id,
    email: user.email,
    provider: user.provider,
    hasPassword: !!user.password,
    role: user.role,
  });

  if (!user.password) {
    console.log('❌ User has no password - run seed again');
    return;
  }

  const match = await bcrypt.compare(password, user.password);
  console.log('Password match:', match ? '✅' : '❌');

  if (!match) {
    const testHash = await bcrypt.hash(password, 12);
    const testMatch = await bcrypt.compare(password, testHash);
    console.log('Fresh bcrypt test:', testMatch ? '✅' : '❌');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
