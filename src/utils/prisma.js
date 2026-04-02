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
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
  logger.warn(
    'API will keep running without DB. Set DATABASE_URL to a reachable Postgres, or use npm run dev with a local DB.'
  );
});

export default prisma;
