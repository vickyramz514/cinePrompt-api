/**
 * Insider Trading service - Executive and director transactions
 */

import { InsiderTrade } from "../models/index.js";

const DEFAULT_LIMIT = 50;

export async function getInsiderTrades(symbol, limit = DEFAULT_LIMIT) {
  const limitVal = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, 100);

  const trades = await InsiderTrade.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["trade_date", "DESC"]],
    limit: limitVal,
    raw: true,
  });

  return trades.map((t) => ({
    name: t.insider_name,
    title: t.title || null,
    transactionType: t.transaction_type,
    shares: t.shares,
    price: t.price ? parseFloat(t.price) : null,
    date: t.trade_date,
  }));
}
