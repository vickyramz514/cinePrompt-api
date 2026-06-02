/**
 * Map API key storage failures to actionable AppError responses
 */

import { AppError } from './errors.js';

export function mapApiKeyError(err) {
  const message = err?.message || String(err);
  const prismaCode = err?.code;
  const lower = message.toLowerCase();

  if (
    lower.includes('api_key_encryption_secret') ||
    lower.includes('jwt_access_secret') ||
    lower.includes('jwt_refresh_secret')
  ) {
    return new AppError(
      'API key encryption is not configured on the server.',
      503,
      'CONFIG_ERROR',
      {
        hint: 'Set API_KEY_ENCRYPTION_SECRET (or JWT_ACCESS_SECRET) in Railway environment variables, then redeploy.',
      }
    );
  }

  if (
    prismaCode === 'P2021' ||
    (lower.includes('apikeysecret') && (lower.includes('does not exist') || lower.includes('not exist')))
  ) {
    return new AppError(
      'API key storage table is missing in the production database.',
      503,
      'DB_MIGRATION_REQUIRED',
      {
        hint: 'Run: npx prisma migrate deploy (or npm run db:migrate:prod) against the Railway DATABASE_URL.',
      }
    );
  }

  if (prismaCode === 'P1001' || prismaCode === 'P1000') {
    return new AppError('Database is unreachable.', 503, 'DB_UNAVAILABLE', {
      hint: 'Check DATABASE_URL on Railway and that Postgres is running.',
    });
  }

  if (err?.name === 'SequelizeDatabaseError') {
    if (lower.includes('key_prefix') || lower.includes('value too long') || lower.includes('varchar')) {
      return new AppError(
        'API keys table schema is outdated (key_prefix column).',
        503,
        'DB_MIGRATION_REQUIRED',
        {
          hint: 'Run prisma migrate deploy on production — migration 20260615120000 widens api_keys.key_prefix.',
        }
      );
    }
  }

  return null;
}
