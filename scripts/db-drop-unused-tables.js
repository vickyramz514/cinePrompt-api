#!/usr/bin/env node
/**
 * Inspect and optionally drop unused Prisma tables.
 *
 * Usage:
 *   node scripts/db-drop-unused-tables.js           # dry-run (row counts only)
 *   node scripts/db-drop-unused-tables.js --apply     # drop tables + enums
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");

/** Prisma tables with zero runtime references (not Sequelize api_usage). */
const UNUSED_PRISMA_TABLES = [
  { name: "CreditUsageLog", note: "Never written or read" },
  { name: "VideoAsset", note: "Video pipeline never stores assets here" },
  { name: "ApiUsage", note: "Superseded by Sequelize api_usage" },
  { name: "NotificationPreference", note: "No preference UI or API" },
  { name: "ErrorLog", note: "Errors go to logs, not DB" },
  { name: "SystemSettings", note: "Feature flags not implemented" },
  { name: "AuditLog", note: "AdminAuditLog used instead" },
  { name: "SystemMetrics", note: "Metrics not implemented" },
];

const DROP_SQL = `
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

async function main() {
  console.log(APPLY ? "Applying unused table cleanup...\n" : "Dry run — unused Prisma tables:\n");

  let totalRows = 0;
  for (const { name, note } of UNUSED_PRISMA_TABLES) {
    const exists = await tableExists(name);
    if (!exists) {
      console.log(`  - ${name}: (already dropped)`);
      continue;
    }
    const count = await rowCount(name);
    totalRows += count;
    console.log(`  - ${name}: ${count.toLocaleString()} rows — ${note}`);
  }

  console.log(`\nTotal rows in unused tables: ${totalRows.toLocaleString()}`);

  if (!APPLY) {
    console.log("\nNo changes made. Run with --apply to drop these tables.");
    console.log("Or deploy migration: npm run db:migrate:prod");
    return;
  }

  if (totalRows > 0) {
    console.warn("\nWarning: some tables still contain rows. Proceeding anyway.");
  }

  await prisma.$executeRawUnsafe(DROP_SQL);
  console.log("\nDropped unused tables and enums.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
