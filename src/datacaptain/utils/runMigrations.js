/**
 * Run Sequelize migrations
 * Creates tables and migrates data from existing Instrument/MarketData if present
 */

import sequelize from "../config/database.js";
import { QueryTypes } from "sequelize";

async function run() {
  try {
    await sequelize.authenticate();
    console.log("Database connected");

    // Create tables via Sequelize sync (dev) or use raw SQL for production
    const { Stock, HistoricalPrice, Company, Dividend, Earnings, ApiUser, ApiKey } = await import("../models/index.js");

    await sequelize.sync({ alter: true });
    console.log("Tables synced");

    // Migrate data from Prisma tables (Instrument, MarketData) if they exist
    try {
      const [rows] = await sequelize.query(
        'SELECT 1 FROM "Instrument" LIMIT 1',
        { type: QueryTypes.SELECT }
      );
      const hasInstruments = Array.isArray(rows) ? rows.length > 0 : !!rows;
      if (hasInstruments) {
        console.log("Migrating from Instrument/MarketData...");
        await sequelize.query(`
          INSERT INTO companies (symbol, company_name, exchange, created_at, updated_at)
          SELECT symbol, name, "exchangeCode", NOW(), NOW()
          FROM "Instrument"
          ON CONFLICT (symbol) DO NOTHING
        `);
        await sequelize.query(`
          INSERT INTO stocks (symbol, name, type, exchange_code, created_at, updated_at)
          SELECT symbol, name, type, "exchangeCode", NOW(), NOW()
          FROM "Instrument"
          ON CONFLICT (symbol) DO NOTHING
        `);
        await sequelize.query(`
          INSERT INTO historical_prices (id, symbol, date, open, high, low, close, volume, created_at, updated_at)
          SELECT gen_random_uuid(), i.symbol, m."asOfDate"::date, m.open::decimal, m.high::decimal, m.low::decimal, m.close::decimal, m.volume::bigint, NOW(), NOW()
          FROM "MarketData" m
          JOIN "Instrument" i ON m."instrumentId" = i.id
          ON CONFLICT (symbol, date) DO NOTHING
        `);
        console.log("Migration complete");
      }
    } catch (e) {
      // Instrument table may not exist
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
