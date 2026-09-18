/**
 * Import market_data_prod.csv into MarketData + historical_prices (no ETF CSV required)
 * Usage: MARKET_CSV_PATH=/path/to/market_data_prod.csv node scripts/sync-market-prices-only.js
 */

import '../src/config/ensureEnv.js';
import { createReadStream } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';
import sequelize from '../src/datacaptain/config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const MARKET_CSV = process.env.MARKET_CSV_PATH || resolve(ROOT, 'market_data_prod.csv');
const prisma = new PrismaClient();

function getCol(row, name) {
  const key = Object.keys(row).find((k) => k.replace(/"/g, '').toLowerCase() === name.toLowerCase());
  return key ? (row[key] || '').trim() : '';
}

async function seedMarketData(csvPath) {
  const stream = createReadStream(csvPath);
  const parser = stream.pipe(parse({ columns: true, relax_column_count: true, bom: true }));
  let count = 0;
  for await (const row of parser) {
    const instrumentId = getCol(row, 'firstbridge_id');
    const asOfDate = getCol(row, 'as_of_date');
    if (!instrumentId || !asOfDate) continue;
    const closeVal = parseFloat(
      getCol(row, 'close_price_split_dividend_adjusted') ||
        getCol(row, 'close_price_split_adjusted') ||
        getCol(row, 'close_price_unadjusted') ||
        '0'
    );
    if (!closeVal) continue;
    const open = parseFloat(getCol(row, 'open_price_split_dividend_adjusted') || String(closeVal));
    const high = parseFloat(getCol(row, 'high_price_split_dividend_adjusted') || String(closeVal));
    const low = parseFloat(getCol(row, 'low_price_split_dividend_adjusted') || String(closeVal));
    const vol = parseInt(getCol(row, 'volume_traded') || '0', 10);
    const volume = Number.isFinite(vol) && vol > 0 ? vol : null;
    await prisma.marketData.upsert({
      where: { instrumentId_asOfDate: { instrumentId, asOfDate: new Date(asOfDate) } },
      create: { instrumentId, asOfDate: new Date(asOfDate), open, high, low, close: closeVal, volume },
      update: { open, high, low, close: closeVal, volume },
    });
    count++;
  }
  return count;
}

async function syncHistoricalPrices() {
  const [priceResult] = await sequelize.query(`
    INSERT INTO historical_prices (id, symbol, date, open, high, low, close, volume, created_at, updated_at)
    SELECT gen_random_uuid(), i.symbol, m."asOfDate"::date,
           m.open::decimal, m.high::decimal, m.low::decimal, m.close::decimal,
           m.volume::bigint, NOW(), NOW()
    FROM "MarketData" m
    JOIN "Instrument" i ON m."instrumentId" = i.id
    ON CONFLICT (symbol, date) DO UPDATE SET
      open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
      close = EXCLUDED.close, volume = EXCLUDED.volume, updated_at = NOW()
  `);
  return priceResult?.rowCount ?? 0;
}

async function main() {
  console.log('Market CSV:', MARKET_CSV);
  const n = await seedMarketData(MARKET_CSV);
  console.log('MarketData rows processed:', n);
  const rows = await syncHistoricalPrices();
  console.log('historical_prices synced (upsert batch):', rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await sequelize.close();
  });
