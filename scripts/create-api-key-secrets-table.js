/**
 * Create api_key_secrets table for storing encrypted DataCaptain API keys.
 * Run: node scripts/create-api-key-secrets-table.js
 * Safe to run multiple times (uses IF NOT EXISTS).
 */

import '../src/config/ensureEnv.js';
import pg from 'pg';

const sql = `
CREATE TABLE IF NOT EXISTS "ApiKeySecret" (
  "apiKeyId" TEXT NOT NULL PRIMARY KEY,
  "encryptedValue" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  try {
    await client.connect();
    await client.query(sql);
    console.log('ApiKeySecret table created (or already exists)');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
