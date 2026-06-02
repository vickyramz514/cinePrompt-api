/**
 * Production startup checks — logs clear fixes in Railway deploy logs
 */

import prisma from './prisma.js';
import { logger } from './logger.js';
import { encryptApiKey } from './encryptApiKey.js';

export async function runStartupChecks() {
  await checkEncryptionConfig();
  await checkApiKeySecretTable();
}

async function checkEncryptionConfig() {
  const hasSecret =
    process.env.API_KEY_ENCRYPTION_SECRET ||
    process.env.JWT_ACCESS_SECRET ||
    process.env.JWT_REFRESH_SECRET;

  if (!hasSecret) {
    logger.error('Startup: missing API_KEY_ENCRYPTION_SECRET / JWT secrets — /api-keys/* will fail');
    return;
  }

  try {
    encryptApiKey('startup-self-test');
    logger.info('Startup: API key encryption OK');
  } catch (err) {
    logger.error('Startup: API key encryption failed', { message: err.message });
  }
}

async function checkApiKeySecretTable() {
  try {
    await prisma.$queryRaw`SELECT 1 FROM "ApiKeySecret" LIMIT 1`;
    logger.info('Startup: ApiKeySecret table OK');
  } catch (err) {
    logger.error('Startup: ApiKeySecret table missing or inaccessible', {
      message: err.message,
      code: err.code,
      fix: 'Run: npm run db:migrate:prod (or node scripts/create-api-key-secrets-table.js)',
    });
  }
}
