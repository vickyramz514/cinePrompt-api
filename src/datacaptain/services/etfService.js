/**
 * ETF Data service
 * List and detail from stocks + historical_prices tables
 */

import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { Stock, HistoricalPrice } from "../models/index.js";

const POPULAR_SYMBOLS = ["SPY", "QQQ", "VTI", "DIA", "ARKK"];
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

function clampLimit(limit) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function clampOffset(offset) {
  const n = parseInt(offset, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

/**
 * @param {{ limit?: number | string, offset?: number | string, search?: string, hasPrice?: boolean | string }} opts
 */
export async function getEtfList(opts = {}) {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const search = (opts.search || "").trim();
  const hasPrice =
    opts.hasPrice === true ||
    opts.hasPrice === "1" ||
    opts.hasPrice === "true";

  const whereParts = [`s.type = 'ETF'`, `(s.is_active IS NULL OR s.is_active = true)`];
  const replacements = { limit, offset };

  if (search) {
    whereParts.push(`(s.symbol ILIKE :search OR s.name ILIKE :search)`);
    replacements.search = `%${search}%`;
  }

  if (hasPrice) {
    whereParts.push(`EXISTS (
      SELECT 1 FROM historical_prices hp0
      WHERE hp0.symbol = s.symbol
      LIMIT 1
    )`);
  }

  const whereClause = whereParts.join(" AND ");
  const orderClause = search
    ? `ORDER BY CASE WHEN hp.close IS NOT NULL THEN 0 ELSE 1 END, s.symbol ASC`
    : `ORDER BY CASE WHEN hp.close IS NOT NULL THEN 0 ELSE 1 END,
       CASE WHEN s.symbol IN ('SPY','QQQ','VTI','DIA','ARKK') THEN 0 ELSE 1 END,
       s.symbol ASC`;

  const [countRow] = await sequelize.query(
    `SELECT COUNT(*)::int AS total FROM stocks s WHERE ${whereClause}`,
    { replacements, type: QueryTypes.SELECT }
  );

  const rows = await sequelize.query(
    `SELECT s.symbol, s.name, s.exchange_code, hp.close AS price
     FROM stocks s
     LEFT JOIN LATERAL (
       SELECT close FROM historical_prices hp2
       WHERE hp2.symbol = s.symbol
       ORDER BY hp2.date DESC
       LIMIT 1
     ) hp ON true
     WHERE ${whereClause}
     ${orderClause}
     LIMIT :limit OFFSET :offset`,
    { replacements, type: QueryTypes.SELECT }
  );

  return {
    data: rows.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      price: r.price != null ? parseFloat(r.price) : null,
      exchange: r.exchange_code ?? null,
    })),
    total: countRow?.total ?? 0,
    limit,
    offset,
    hasPrice,
  };
}

export async function getEtfBySymbol(symbol) {
  const sym = symbol?.toUpperCase();
  if (!sym) return null;

  const [stock, price] = await Promise.all([
    Stock.findOne({
      where: { symbol: sym, type: "ETF" },
      raw: true,
    }),
    HistoricalPrice.findOne({
      where: { symbol: sym },
      order: [["date", "DESC"]],
      attributes: ["close", "date", "volume", "open", "high", "low"],
      raw: true,
    }),
  ]);

  if (!stock) return null;

  return {
    symbol: sym,
    name: stock.name ?? sym,
    type: "ETF",
    exchange: stock.exchange_code ?? null,
    price: price ? parseFloat(price.close) : null,
    ...(price && {
      date: price.date,
      open: parseFloat(price.open),
      high: parseFloat(price.high),
      low: parseFloat(price.low),
      volume: price.volume ? Number(price.volume) : null,
    }),
  };
}

export { POPULAR_SYMBOLS };
