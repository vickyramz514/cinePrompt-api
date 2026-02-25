/**
 * Prisma client singleton
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger.js';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'error', 'warn']
    : ['error'],
});

prisma.$connect().catch((err) => {
  logger.error('Prisma connection failed', { error: err.message });
  process.exit(1);
});

export default prisma;
