/**
 * Options Chain service - Fetches option contracts for a symbol
 */

import { OptionContract } from "../models/index.js";
import { Op } from "sequelize";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function getOptionsChain(symbol, options = {}) {
  const { expirationDate, limit = DEFAULT_LIMIT } = options;
  const limitVal = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);

  const where = { symbol: symbol.toUpperCase() };
  if (expirationDate) {
    where.expiration_date = expirationDate;
  }

  const contracts = await OptionContract.findAll({
    where,
    order: [["expiration_date", "ASC"], ["strike", "ASC"]],
    limit: limitVal * 2,
    raw: true,
  });

  const expDates = [...new Set(contracts.map((c) => c.expiration_date))].sort();
  const targetExp = expirationDate || expDates[0];

  const filtered = targetExp
    ? contracts.filter((c) => c.expiration_date === targetExp)
    : contracts;

  const calls = filtered
    .filter((c) => c.type === "CALL")
    .slice(0, limitVal)
    .map((c) => ({
      strike: parseFloat(c.strike),
      bid: c.bid ? parseFloat(c.bid) : null,
      ask: c.ask ? parseFloat(c.ask) : null,
      volume: c.volume ?? null,
      openInterest: c.open_interest ?? null,
    }));

  const puts = filtered
    .filter((c) => c.type === "PUT")
    .slice(0, limitVal)
    .map((c) => ({
      strike: parseFloat(c.strike),
      bid: c.bid ? parseFloat(c.bid) : null,
      ask: c.ask ? parseFloat(c.ask) : null,
      volume: c.volume ?? null,
      openInterest: c.open_interest ?? null,
    }));

  return {
    symbol: symbol.toUpperCase(),
    expirationDate: targetExp || null,
    calls,
    puts,
  };
}
