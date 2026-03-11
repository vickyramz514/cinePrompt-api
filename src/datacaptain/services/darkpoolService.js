/**
 * Dark Pool Trades service - Dark pool activity by symbol
 */

import { DarkPoolTrade } from "../models/index.js";

const DEFAULT_LIMIT = 50;

export async function getDarkPoolTrades(symbol, limit = DEFAULT_LIMIT) {
  const limitVal = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, 100);

  const trades = await DarkPoolTrade.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["trade_time", "DESC"]],
    limit: limitVal,
    raw: true,
  });

  return trades.map((t) => ({
    symbol: t.symbol,
    price: parseFloat(t.price),
    volume: t.volume,
    tradeTime: t.trade_time,
  }));
}
