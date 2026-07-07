/**
 * Bulk import dmd_batch_*.csv → MarketData → historical_prices
 *
 * Usage:
 *   DMD_DIR=/Users/vigneshwar/Downloads/output \
 *   US_ONLY=1 SINCE=2010-01-01 \
 *   node scripts/import-dmd-batches.js
 *
 * Env:
 *   DMD_DIR          — folder with dmd_batch_*.csv (required)
 *   US_ONLY=1        — only instruments with listingCountryCode US (default 1)
 *   SINCE=2010-01-01 — skip rows before this date
 *   BATCH_SIZE=2000  — rows per INSERT
 *   SYNC_HISTORICAL=1 — sync historical_prices after import (default 1)
 *   RESUME=1         — skip files listed in progress file (default 1)
 *   MAX_FILES=N      — limit files (testing)
 *   COMPUTE_METRICS=1 — run etf metrics after sync (default 0)
 */

import "../src/config/ensureEnv.js";
import { createReadStream, existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse";
import pg from "pg";
import { PrismaClient } from "@prisma/client";
import sequelize from "../src/datacaptain/config/database.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const DMD_DIR = process.env.DMD_DIR;
const US_ONLY = process.env.US_ONLY !== "0";
const SINCE = process.env.SINCE || "2010-01-01";
const BATCH_SIZE = Math.max(100, parseInt(process.env.BATCH_SIZE || "2000", 10));
const SYNC_HISTORICAL = process.env.SYNC_HISTORICAL !== "0";
const RESUME = process.env.RESUME !== "0";
const MAX_FILES = process.env.MAX_FILES ? parseInt(process.env.MAX_FILES, 10) : null;
const COMPUTE_METRICS = process.env.COMPUTE_METRICS === "1";

const PROGRESS_FILE = resolve(ROOT, ".dmd-import-progress.json");

const prisma = new PrismaClient();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function getCol(row, name) {
  const key = Object.keys(row).find(
    (k) => k.replace(/"/g, "").toLowerCase() === name.toLowerCase()
  );
  return key ? String(row[key] ?? "").trim() : "";
}

function parsePrice(row, ...names) {
  for (const n of names) {
    const v = parseFloat(getCol(row, n));
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

function rowToRecord(row, allowedIds) {
  const instrumentId = getCol(row, "firstbridge_id");
  const asOfDate = getCol(row, "as_of_date");
  if (!instrumentId || !asOfDate || asOfDate < SINCE) return null;
  if (!allowedIds.has(instrumentId)) return null;

  const closeVal = parsePrice(
    row,
    "close_price_split_dividend_adjusted",
    "close_price_split_adjusted",
    "close_price_unadjusted"
  );
  if (!closeVal) return null;

  const openVal = parsePrice(
    row,
    "open_price_split_dividend_adjusted",
    "open_price_split_adjusted",
    "open_price_unadjusted"
  );
  const highVal = parsePrice(
    row,
    "high_price_split_dividend_adjusted",
    "high_price_split_adjusted",
    "high_price_unadjusted"
  );
  const lowVal = parsePrice(
    row,
    "low_price_split_dividend_adjusted",
    "low_price_split_adjusted",
    "low_price_unadjusted"
  );

  const open = openVal || closeVal;
  const high = highVal || closeVal;
  const low = lowVal || closeVal;

  const volRaw = getCol(row, "volume_traded");
  const vol = volRaw ? Math.round(parseFloat(volRaw)) : null;
  const volume = Number.isFinite(vol) && vol > 0 ? vol : null;

  const navRaw =
    getCol(row, "nav_split_dividend_adjusted") || getCol(row, "nav_split_adjusted");
  const navParsed = navRaw ? parseFloat(navRaw) : null;
  const nav = Number.isFinite(navParsed) && navParsed > 0 ? navParsed : null;

  return { instrumentId, asOfDate, open, high, low, close: closeVal, volume, nav };
}

async function loadAllowedInstrumentIds() {
  const where = US_ONLY
    ? { OR: [{ listingCountryCode: "US" }, { listingCountryCode: null }] }
    : {};
  const rows = await prisma.instrument.findMany({
    where,
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

function listBatchFiles() {
  if (!DMD_DIR || !existsSync(DMD_DIR)) {
    throw new Error(`DMD_DIR not found: ${DMD_DIR}`);
  }
  return readdirSync(DMD_DIR)
    .filter((f) => /^dmd_batch_\d+\.csv$/i.test(f))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)[0], 10);
      const nb = parseInt(b.match(/\d+/)[0], 10);
      return na - nb;
    });
}

function loadProgress() {
  if (!RESUME || !existsSync(PROGRESS_FILE)) return { completedFiles: [] };
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf8"));
  } catch {
    return { completedFiles: [] };
  }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function insertBatch(records) {
  if (!records.length) return 0;

  const cols = [
    "instrumentId",
    "asOfDate",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "nav",
  ];
  const values = [];
  const params = [];
  let p = 1;

  for (const r of records) {
    values.push(
      `(gen_random_uuid(), $${p++}, $${p++}::date, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}::bigint, $${p++}, NOW(), NOW())`
    );
    params.push(
      r.instrumentId,
      r.asOfDate,
      r.open,
      r.high,
      r.low,
      r.close,
      r.volume,
      r.nav
    );
  }

  const sql = `
    INSERT INTO "MarketData" (id, "instrumentId", "asOfDate", open, high, low, close, volume, nav, "createdAt", "updatedAt")
    VALUES ${values.join(",\n")}
    ON CONFLICT ("instrumentId", "asOfDate") DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      nav = EXCLUDED.nav,
      "updatedAt" = NOW()
  `;

  await pool.query(sql, params);
  return records.length;
}

async function importFile(filePath, allowedIds, stats) {
  const stream = createReadStream(filePath);
  const parser = stream.pipe(
    parse({ columns: true, relax_column_count: true, bom: true })
  );

  let batch = [];
  let fileInserted = 0;
  const touchedInstruments = new Set();

  for await (const row of parser) {
    const rec = rowToRecord(row, allowedIds);
    if (!rec) continue;
    touchedInstruments.add(rec.instrumentId);
    batch.push(rec);
    if (batch.length >= BATCH_SIZE) {
      const n = await insertBatch(batch);
      fileInserted += n;
      stats.totalInserted += n;
      batch = [];
      if (stats.totalInserted % 100000 < BATCH_SIZE) {
        console.log(`  … ${stats.totalInserted.toLocaleString()} rows inserted total`);
      }
    }
  }

  if (batch.length) {
    const n = await insertBatch(batch);
    fileInserted += n;
    stats.totalInserted += n;
  }

  return { fileInserted, touchedInstruments: [...touchedInstruments] };
}

async function syncHistoricalForInstruments(instrumentIds) {
  if (!instrumentIds.length) return 0;
  await sequelize.query(
    `
    INSERT INTO historical_prices (id, symbol, date, open, high, low, close, volume, created_at, updated_at)
    SELECT gen_random_uuid(), i.symbol, m."asOfDate"::date,
           m.open::decimal, m.high::decimal, m.low::decimal, m.close::decimal,
           m.volume::bigint, NOW(), NOW()
    FROM "MarketData" m
    JOIN "Instrument" i ON m."instrumentId" = i.id
    WHERE m."instrumentId" = ANY($1::text[])
    ON CONFLICT (symbol, date) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      updated_at = NOW()
    `,
    { bind: [instrumentIds] }
  );
  return instrumentIds.length;
}

async function syncHistoricalPrices() {
  console.log("\nSyncing ALL historical_prices from MarketData…");
  await sequelize.query(`
    INSERT INTO historical_prices (id, symbol, date, open, high, low, close, volume, created_at, updated_at)
    SELECT gen_random_uuid(), i.symbol, m."asOfDate"::date,
           m.open::decimal, m.high::decimal, m.low::decimal, m.close::decimal,
           m.volume::bigint, NOW(), NOW()
    FROM "MarketData" m
    JOIN "Instrument" i ON m."instrumentId" = i.id
    ON CONFLICT (symbol, date) DO UPDATE SET
      open = EXCLUDED.open,
      high = EXCLUDED.high,
      low = EXCLUDED.low,
      close = EXCLUDED.close,
      volume = EXCLUDED.volume,
      updated_at = NOW()
  `);
}

async function main() {
  if (!DMD_DIR) {
    throw new Error("Set DMD_DIR to the folder containing dmd_batch_*.csv files");
  }

  console.log("DMD bulk import");
  console.log("  DMD_DIR:", DMD_DIR);
  console.log("  US_ONLY:", US_ONLY);
  console.log("  SINCE:", SINCE);
  console.log("  BATCH_SIZE:", BATCH_SIZE);

  const allowedIds = await loadAllowedInstrumentIds();
  console.log(`  Allowed instruments: ${allowedIds.size.toLocaleString()}`);

  const files = listBatchFiles();
  console.log(`  Batch files found: ${files.length}`);

  const progress = loadProgress();
  const completed = new Set(progress.completedFiles || []);
  const stats = { totalInserted: progress.totalInserted || 0, filesDone: 0 };

  const toProcess = files.filter((f) => !completed.has(f));
  const limited = MAX_FILES ? toProcess.slice(0, MAX_FILES) : toProcess;

  console.log(`  Files to process: ${limited.length} (${completed.size} already done)\n`);

  const started = Date.now();

  for (const file of limited) {
    const filePath = join(DMD_DIR, file);
    const t0 = Date.now();
    console.log(`→ ${file}`);
    const { fileInserted, touchedInstruments } = await importFile(filePath, allowedIds, stats);
    const sec = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ ${fileInserted.toLocaleString()} MarketData rows in ${sec}s`);

    if (SYNC_HISTORICAL && touchedInstruments.length) {
      await syncHistoricalForInstruments(touchedInstruments);
      console.log(`  ✓ historical_prices synced for ${touchedInstruments.length} ETFs`);
    }

    completed.add(file);
    stats.filesDone += 1;
    saveProgress({
      completedFiles: [...completed],
      totalInserted: stats.totalInserted,
      lastFile: file,
      updatedAt: new Date().toISOString(),
    });
  }

  if (COMPUTE_METRICS && completed.size === files.length) {
    console.log("\nRunning etf:compute-metrics…");
    const { spawn } = await import("child_process");
    await new Promise((resolve, reject) => {
      const child = spawn("node", ["scripts/compute-etf-metrics.js"], {
        cwd: ROOT,
        stdio: "inherit",
      });
      child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`metrics exit ${code}`))));
    });
  }

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`\n✓ Import pass complete in ${mins} min`);
  console.log(`  Total MarketData rows this run: ${stats.totalInserted.toLocaleString()}`);
  console.log(`  Files completed overall: ${completed.size}/${files.length}`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
    await prisma.$disconnect();
    await sequelize.close();
  });
