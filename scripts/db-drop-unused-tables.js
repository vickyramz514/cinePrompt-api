#!/usr/bin/env node
/**
 * Inspect and optionally drop unused / legacy Prisma tables.
 *
 * Usage:
 *   node scripts/db-drop-unused-tables.js              # dry-run
 *   node scripts/db-drop-unused-tables.js --apply      # drop unused tables
 *   node scripts/db-drop-unused-tables.js --apply --video  # also drop video pipeline
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const INCLUDE_VIDEO = process.argv.includes('--video');

const UNUSED_PRISMA_TABLES = [
  { name: 'CreditUsageLog', note: 'Never written or read' },
  { name: 'VideoAsset', note: 'Legacy video asset store' },
  { name: 'ApiUsage', note: 'Superseded by Sequelize api_usage' },
  { name: 'NotificationPreference', note: 'No preference UI or API' },
  { name: 'ErrorLog', note: 'Errors go to logs, not DB' },
  { name: 'SystemSettings', note: 'Feature flags not implemented' },
  { name: 'AuditLog', note: 'AdminAuditLog used instead' },
  { name: 'SystemMetrics', note: 'Metrics not implemented' },
];

const VIDEO_PIPELINE_TABLES = [
  { name: 'JobStep', note: 'Video pipeline step log' },
  { name: 'VideoJob', note: 'Legacy video generation jobs' },
  { name: 'CreditLock', note: 'Pre-charge locks for video' },
  { name: 'ApiCostLog', note: 'Video provider cost log' },
  { name: 'AbuseLog', note: 'Video abuse tracking' },
];

const DROP_UNUSED_SQL = `
DROP TABLE IF EXISTS "CreditUsageLog" CASCADE;
DROP TABLE IF EXISTS "VideoAsset" CASCADE;
DROP TABLE IF EXISTS "ApiUsage" CASCADE;
DROP TABLE IF EXISTS "NotificationPreference" CASCADE;
DROP TABLE IF EXISTS "ErrorLog" CASCADE;
DROP TABLE IF EXISTS "SystemSettings" CASCADE;
DROP TABLE IF EXISTS "AuditLog" CASCADE;
DROP TABLE IF EXISTS "SystemMetrics" CASCADE;
DROP TYPE IF EXISTS "ErrorSeverity";
DROP TYPE IF EXISTS "NotificationChannel";
`;

const DROP_VIDEO_SQL = `
DROP TABLE IF EXISTS "JobStep" CASCADE;
DROP TABLE IF EXISTS "VideoJob" CASCADE;
DROP TABLE IF EXISTS "CreditLock" CASCADE;
DROP TABLE IF EXISTS "ApiCostLog" CASCADE;
DROP TABLE IF EXISTS "AbuseLog" CASCADE;
DROP TYPE IF EXISTS "JobStepStatus";
DROP TYPE IF EXISTS "JobStepType";
DROP TYPE IF EXISTS "VideoJobStatus";
`;

const prisma = new PrismaClient();

async function tableExists(table) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${table}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function rowCount(table) {
  const quoted = `"${table.replace(/"/g, '""')}"`;
  const rows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${quoted}`);
  return Number(rows[0]?.count ?? 0);
}

async function reportTables(tables) {
  let totalRows = 0;
  for (const { name, note } of tables) {
    const exists = await tableExists(name);
    if (!exists) {
      console.log(`  - ${name}: (already dropped)`);
      continue;
    }
    const count = await rowCount(name);
    totalRows += count;
    console.log(`  - ${name}: ${count.toLocaleString()} rows — ${note}`);
  }
  return totalRows;
}

async function main() {
  const tables = INCLUDE_VIDEO
    ? [...UNUSED_PRISMA_TABLES, ...VIDEO_PIPELINE_TABLES]
    : UNUSED_PRISMA_TABLES;

  console.log(
    APPLY
      ? `Applying cleanup${INCLUDE_VIDEO ? ' (including video pipeline)' : ''}...\n`
      : `Dry run${INCLUDE_VIDEO ? ' (including video pipeline)' : ''}:\n`
  );

  const totalRows = await reportTables(tables);
  console.log(`\nTotal rows in listed tables: ${totalRows.toLocaleString()}`);

  if (!APPLY) {
    console.log('\nNo changes made. Run with --apply to drop tables.');
    console.log('Add --video to include VideoJob and related tables.');
    console.log('Or deploy migrations: npm run db:migrate:prod');
    return;
  }

  if (totalRows > 0) {
    console.warn('\nWarning: some tables still contain rows. Proceeding anyway.');
  }

  await prisma.$executeRawUnsafe(DROP_UNUSED_SQL);
  if (INCLUDE_VIDEO) {
    await prisma.$executeRawUnsafe(DROP_VIDEO_SQL);
  }
  console.log('\nDropped tables and enums.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
