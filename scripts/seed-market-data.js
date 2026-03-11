/**
 * Seed Stock/ETF market data from CSV files
 * Run: npm run db:seed:market
 *
 * Requires: market_data_prod.csv and etf_universe_prod.csv in project root (AIPro/)
 */

import { createReadStream } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "csv-parse";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../.."); // AIPro/
const ETF_CSV = resolve(ROOT, "etf_universe_prod.csv");
const MARKET_CSV = resolve(ROOT, "market_data_prod.csv");

const prisma = new PrismaClient();

function getCol(row, name) {
  const key = Object.keys(row).find((k) => k.replace(/"/g, "").toLowerCase() === name.toLowerCase());
  return key ? (row[key] || "").trim() : "";
}

async function seedInstruments() {
  const stream = createReadStream(ETF_CSV);
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
    const id = getCol(row, "firstbridge_id");
    const symbol = getCol(row, "composite_ticker");
    const name = getCol(row, "composite_name");
    const exchangeCode = getCol(row, "exchange_code") || undefined;
    const exchangeName = getCol(row, "exchange_name") || undefined;
    const assetClass = getCol(row, "asset_class") || undefined;
    const listingCountry = getCol(row, "listing_country_code") || undefined;
    const inception = getCol(row, "inception_date");

    if (!id || !symbol) continue;

    batch.push({
      id,
      symbol,
      name: name || symbol,
      type: "ETF",
      exchangeCode: exchangeCode || undefined,
      exchangeName: exchangeName || undefined,
      assetClass: assetClass || undefined,
      listingCountryCode: listingCountry || undefined,
      inceptionDate:
        inception && inception !== "Not Applicable" ? new Date(inception) : null,
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

async function seedMarketData() {
  const stream = createReadStream(MARKET_CSV);
  const parser = stream.pipe(
    parse({
      columns: true,
      relax_column_count: true,
      bom: true,
    })
  );

  let count = 0;

  for await (const row of parser) {
    const instrumentId = getCol(row, "firstbridge_id");
    const asOfDate = getCol(row, "as_of_date");
    const openVal =
      parseFloat(
        getCol(row, "open_price_split_dividend_adjusted") ||
          getCol(row, "open_price_split_adjusted") ||
          getCol(row, "open_price_unadjusted")
      ) || 0;
    const highVal =
      parseFloat(
        getCol(row, "high_price_split_dividend_adjusted") ||
          getCol(row, "high_price_split_adjusted") ||
          getCol(row, "high_price_unadjusted")
      ) || 0;
    const lowVal =
      parseFloat(
        getCol(row, "low_price_split_dividend_adjusted") ||
          getCol(row, "low_price_split_adjusted") ||
          getCol(row, "low_price_unadjusted")
      ) || 0;
    const closeVal =
      parseFloat(
        getCol(row, "close_price_split_dividend_adjusted") ||
          getCol(row, "close_price_split_adjusted") ||
          getCol(row, "close_price_unadjusted")
      ) || 0;
    const volumeStr = getCol(row, "volume_traded");
    const navStr =
      getCol(row, "nav_split_dividend_adjusted") ||
      getCol(row, "nav_split_adjusted");

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
    } catch (e) {
      // Ensure instrument exists
      await prisma.instrument.upsert({
        where: { id: instrumentId },
        create: {
          id: instrumentId,
          symbol: instrumentId.slice(0, 12),
          name: instrumentId,
          type: "ETF",
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
  console.log("Seeding stock/ETF market data from CSV...");
  console.log("Root:", ROOT);

  try {
    console.log("\n1. Seeding instruments from etf_universe_prod.csv");
    const instrCount = await seedInstruments();
    console.log(`   Done: ${instrCount} instruments`);

    console.log("\n2. Seeding market data from market_data_prod.csv");
    const dataCount = await seedMarketData();
    console.log(`   Done: ${dataCount} price records`);

    console.log("\n✓ Seed complete");
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
