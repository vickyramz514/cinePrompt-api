/**
 * Market movers service - Top gainers, losers, most active
 */

import { HistoricalPrice } from "../models/index.js";
import sequelize from "../config/database.js";
import { Op } from "sequelize";

export async function getTopGainers(limit = 10) {
  const [rows] = await sequelize.query(`
    WITH latest AS (
      SELECT DISTINCT ON (symbol) symbol, date, close,
        LAG(close) OVER (PARTITION BY symbol ORDER BY date) as prev_close
      FROM historical_prices
      WHERE date >= CURRENT_DATE - INTERVAL '5 days'
    ),
    calc AS (
      SELECT symbol, close as price,
        (close - prev_close) as change,
        CASE WHEN prev_close > 0 THEN ((close - prev_close) / prev_close * 100) ELSE 0 END as change_percent
      FROM latest WHERE prev_close IS NOT NULL
    )
    SELECT * FROM calc WHERE change_percent > 0 ORDER BY change_percent DESC LIMIT ${parseInt(limit, 10)}
  `);
  return rows;
}

export async function getTopLosers(limit = 10) {
  const [rows] = await sequelize.query(`
    WITH latest AS (
      SELECT DISTINCT ON (symbol) symbol, date, close,
        LAG(close) OVER (PARTITION BY symbol ORDER BY date) as prev_close
      FROM historical_prices
      WHERE date >= CURRENT_DATE - INTERVAL '5 days'
    ),
    calc AS (
      SELECT symbol, close as price,
        (close - prev_close) as change,
        CASE WHEN prev_close > 0 THEN ((close - prev_close) / prev_close * 100) ELSE 0 END as change_percent
      FROM latest WHERE prev_close IS NOT NULL
    )
    SELECT * FROM calc WHERE change_percent < 0 ORDER BY change_percent ASC LIMIT ${parseInt(limit, 10)}
  `);
  return rows;
}

export async function getMostActive(limit = 10) {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  const weekAgo = d.toISOString().slice(0, 10);

  const rows = await HistoricalPrice.findAll({
    attributes: [
      "symbol",
      [sequelize.fn("SUM", sequelize.col("volume")), "total_volume"],
      [sequelize.fn("MAX", sequelize.col("close")), "price"],
    ],
    where: { date: { [Op.gte]: weekAgo } },
    group: ["symbol"],
    order: [[sequelize.literal("total_volume"), "DESC"]],
    limit: parseInt(limit, 10),
    raw: true,
  });
  return rows.map((r) => ({
    symbol: r.symbol,
    price: parseFloat(r.price || 0),
    total_volume: Number(r.total_volume || 0),
  }));
}
