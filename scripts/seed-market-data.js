/**
 * Seed Stock/ETF market data from CSV files
 *
 * Run from cinePrompt-api:
 *   npm run db:seed:market
 *
 * CSV files (place in AIPro/ project root):
 *   - data_etf_universe.csv  OR  etf_universe_prod.csv  (ETF metadata)
 *   - market_data_prod.csv     (optional — daily OHLCV prices)
 *
 * Env:
 *   ETF_CSV_PATH=/path/to/data_etf_universe.csv
 *   MARKET_CSV_PATH=/path/to/market_data_prod.csv
 *   SKIP_MARKET_DATA=1          — only load ETF universe, skip prices
 *   ETF_SYNC_ALL=1              — sync all countries to stocks (default: US listings only)
 */

import '../src/config/ensureEnv.js';
import { createReadStream, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import { PrismaClient } from '@prisma/client';
import sequelize from '../src/datacaptain/config/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..'); // AIPro/

const ETF_CSV = resolveCsv('ETF_CSV_PATH', [
  'data_etf_universe.csv',
  'etf_universe_prod.csv',
]);
const MARKET_CSV = resolveCsv('MARKET_CSV_PATH', ['market_data_prod.csv']);
const SKIP_MARKET_DATA = process.env.SKIP_MARKET_DATA === '1' || process.env.SKIP_MARKET_DATA === 'true';
const ETF_SYNC_ALL = process.env.ETF_SYNC_ALL === '1' || process.env.ETF_SYNC_ALL === 'true';

const prisma = new PrismaClient();

function resolveCsv(envKey, candidates) {
  if (process.env[envKey]) {
    const p = resolve(process.env[envKey]);
    if (!existsSync(p)) throw new Error(`${envKey} file not found: ${p}`);
    return p;
  }
  for (const name of candidates) {
    const p = resolve(ROOT, name);
    if (existsSync(p)) return p;
  }
  throw new Error(
    `CSV not found. Set ${envKey} or place one of: ${candidates.join(', ')} in ${ROOT}`
  );
}

function getCol(row, name) {
  const key = Object.keys(row).find((k) => k.replace(/"/g, '').toLowerCase() === name.toLowerCase());
  return key ? (row[key] || '').trim() : '';
}

async function seedInstruments(csvPath) {
  const stream = createReadStream(csvPath);
  const parser = stream.pipe(
    parse({
      columns: true,
      relax_column_count: true,
      bom: true,
    })
  );

  let count = 0;
  const BATCH = 500;
  let batch = [];

  for await (const row of parser) {
    const id = getCol(row, 'firstbridge_id');
    const symbol = getCol(row, 'composite_ticker').toUpperCase();
    const name = getCol(row, 'composite_name');
    const exchangeCode = getCol(row, 'exchange_code') || undefined;
    const exchangeName = getCol(row, 'exchange_name') || undefined;
    const assetClass = getCol(row, 'asset_class') || undefined;
    const listingCountry = getCol(row, 'listing_country_code') || undefined;
    const inception = getCol(row, 'inception_date');

    if (!id || !symbol) continue;

    batch.push({
      id,
      symbol,
      name: name || symbol,
      type: 'ETF',
      exchangeCode: exchangeCode || undefined,
      exchangeName: exchangeName || undefined,
      assetClass: assetClass || undefined,
      listingCountryCode: listingCountry || undefined,
      inceptionDate:
        inception && inception !== 'Not Applicable' ? new Date(inception) : null,
    });

    if (batch.length >= BATCH) {
      await prisma.instrument.createMany({
        data: batch,
        skipDuplicates: true,
      });
      count += batch.length;
      console.log(`  Instruments: ${count}...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    await prisma.instrument.createMany({
      data: batch,
      skipDuplicates: true,
    });
    count += batch.length;
  }

  return count;
}

async function syncToStocksTable() {
  await sequelize.sync({ alter: true });

  const countryFilter = ETF_SYNC_ALL
    ? ''
    : 'WHERE "listingCountryCode" = \'US\' OR "listingCountryCode" IS NULL';

  const [companyResult] = await sequelize.query(`
    INSERT INTO companies (symbol, company_name, exchange, created_at, updated_at)
    SELECT DISTINCT ON (symbol) symbol, name, "exchangeCode", NOW(), NOW()
    FROM "Instrument"
    ${countryFilter}
    ORDER BY symbol, CASE WHEN "listingCountryCode" = 'US' THEN 0 ELSE 1 END
    ON CONFLICT (symbol) DO UPDATE SET
      company_name = EXCLUDED.company_name,
      exchange = EXCLUDED.exchange,
      updated_at = NOW()
  `);

  const [stockResult] = await sequelize.query(`
    INSERT INTO stocks (symbol, name, type, exchange_code, is_active, created_at, updated_at)
    SELECT DISTINCT ON (symbol) symbol, name, type, "exchangeCode", true, NOW(), NOW()
    FROM "Instrument"
    ${countryFilter}
    ORDER BY symbol, CASE WHEN "listingCountryCode" = 'US' THEN 0 ELSE 1 END
    ON CONFLICT (symbol) DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      exchange_code = EXCLUDED.exchange_code,
      is_active = true,
      updated_at = NOW()
  `);

  return {
    companies: companyResult?.rowCount ?? 0,
    stocks: stockResult?.rowCount ?? 0,
  };
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
    open = EXCLUDED.open,
    high = EXCLUDED.high,
    low = EXCLUDED.low,
    close = EXCLUDED.close,
    volume = EXCLUDED.volume,
    updated_at = NOW()
  `);

  return priceResult?.rowCount ?? 0;
}

async function seedMarketData(csvPath) {
  const stream = createReadStream(csvPath);
  const parser = stream.pipe(
    parse({
      columns: true,
      relax_column_count: true,
      bom: true,
    })
  );

  let count = 0;

  for await (const row of parser) {
    const instrumentId = getCol(row, 'firstbridge_id');
    const asOfDate = getCol(row, 'as_of_date');
    const openVal =
      parseFloat(
        getCol(row, 'open_price_split_dividend_adjusted') ||
          getCol(row, 'open_price_split_adjusted') ||
          getCol(row, 'open_price_unadjusted')
      ) || 0;
    const highVal =
      parseFloat(
        getCol(row, 'high_price_split_dividend_adjusted') ||
          getCol(row, 'high_price_split_adjusted') ||
          getCol(row, 'high_price_unadjusted')
      ) || 0;
    const lowVal =
      parseFloat(
        getCol(row, 'low_price_split_dividend_adjusted') ||
          getCol(row, 'low_price_split_adjusted') ||
          getCol(row, 'low_price_unadjusted')
      ) || 0;
    const closeVal =
      parseFloat(
        getCol(row, 'close_price_split_dividend_adjusted') ||
          getCol(row, 'close_price_split_adjusted') ||
          getCol(row, 'close_price_unadjusted')
      ) || 0;
    const volumeStr = getCol(row, 'volume_traded');
    const navStr =
      getCol(row, 'nav_split_dividend_adjusted') ||
      getCol(row, 'nav_split_adjusted');

    if (!instrumentId || !asOfDate || !closeVal) continue;

    const open = openVal || closeVal;
    const high = highVal || closeVal;
    const low = lowVal || closeVal;
    const volume = volumeStr ? BigInt(Math.round(parseFloat(volumeStr))) : null;
    const nav = navStr ? parseFloat(navStr) : null;

    try {
      await prisma.marketData.upsert({
        where: {
          instrumentId_asOfDate: {
            instrumentId,
            asOfDate: new Date(asOfDate),
          },
        },
        create: {
          instrumentId,
          asOfDate: new Date(asOfDate),
          open,
          high,
          low,
          close: closeVal,
          volume,
          nav,
        },
        update: { open, high, low, close: closeVal, volume, nav },
      });
      count++;
      if (count % 100 === 0) console.log(`  Market data: ${count}...`);
    } catch {
      await prisma.instrument.upsert({
        where: { id: instrumentId },
        create: {
          id: instrumentId,
          symbol: instrumentId.slice(0, 12),
          name: instrumentId,
          type: 'ETF',
        },
        update: {},
      });
      await prisma.marketData.upsert({
        where: {
          instrumentId_asOfDate: {
            instrumentId,
            asOfDate: new Date(asOfDate),
          },
        },
        create: {
          instrumentId,
          asOfDate: new Date(asOfDate),
          open,
          high,
          low,
          close: closeVal,
          volume,
          nav,
        },
        update: { open, high, low, close: closeVal, volume, nav },
      });
      count++;
    }
  }

  return count;
}

async function main() {
  console.log('Seeding stock/ETF market data from CSV...');
  console.log('Root:', ROOT);
  console.log('ETF CSV:', ETF_CSV);
  if (!SKIP_MARKET_DATA) console.log('Market CSV:', MARKET_CSV);
  console.log('Stocks sync:', ETF_SYNC_ALL ? 'all countries' : 'US listings only');

  try {
    console.log('\n1. Seeding Instrument table from ETF universe CSV');
    const instrCount = await seedInstruments(ETF_CSV);
    console.log(`   Done: ${instrCount} rows processed`);

    console.log('\n2. Syncing stocks + companies tables (DataCaptain API)');
    const sync = await syncToStocksTable();
    console.log(`   Done: ${sync.stocks} stock rows upserted, ${sync.companies} company rows`);

    if (!SKIP_MARKET_DATA && existsSync(MARKET_CSV)) {
      console.log('\n3. Seeding MarketData from price CSV');
      const dataCount = await seedMarketData(MARKET_CSV);
      console.log(`   Done: ${dataCount} price records`);

      console.log('\n4. Syncing historical_prices table');
      const priceRows = await syncHistoricalPrices();
      console.log(`   Done: ${priceRows} historical price rows upserted`);
    } else {
      console.log('\n3. Skipped market price CSV (SKIP_MARKET_DATA or file missing)');
    }

    console.log('\n✓ Seed complete');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await sequelize.close();
  }
}

main();
