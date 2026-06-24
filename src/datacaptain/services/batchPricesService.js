/**
 * Batch ETF Prices service
 * Returns latest price for multiple ETF symbols (max 50)
 */

import sequelize from "../config/database.js";
import { QueryTypes, Op } from "sequelize";
import { Stock } from "../models/index.js";

const MAX_SYMBOLS = 50;

export async function getBatchPrices(symbolsParam) {
  if (!symbolsParam || typeof symbolsParam !== "string") {
    return [];
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) return [];
  if (symbols.length > MAX_SYMBOLS) {
    throw new Error(`Maximum ${MAX_SYMBOLS} symbols allowed`);
  }

  const etfRows = await Stock.findAll({
    where: { symbol: { [Op.in]: symbols }, type: "ETF" },
    attributes: ["symbol"],
    raw: true,
  });
  const etfSymbols = etfRows.map((r) => r.symbol);
  if (etfSymbols.length === 0) return [];

  const placeholders = etfSymbols.map((_, i) => `:s${i}`).join(", ");
  const replacements = {};
  etfSymbols.forEach((s, i) => {
    replacements[`s${i}`] = s;
  });

  const rows = await sequelize.query(
    `
    WITH latest AS (
      SELECT DISTINCT ON (symbol) symbol, close
      FROM historical_prices
      WHERE symbol IN (${placeholders})
      ORDER BY symbol, date DESC
    )
    SELECT symbol, close as price FROM latest
    `,
    {
      replacements,
      type: QueryTypes.SELECT,
    }
  );

  return (rows || []).map((r) => ({
    symbol: r.symbol,
    price: parseFloat(r.price),
  }));
}
