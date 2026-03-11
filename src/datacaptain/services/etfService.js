/**
 * ETF Data service
 * Popular ETFs and single ETF details
 */

import { Stock, HistoricalPrice } from "../models/index.js";
import { Op } from "sequelize";

const POPULAR_ETFS = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust" },
  { symbol: "QQQ", name: "Invesco QQQ Trust" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF" },
  { symbol: "DIA", name: "SPDR Dow Jones Industrial Average ETF" },
  { symbol: "ARKK", name: "ARK Innovation ETF" },
];

export async function getEtfList() {
  const symbols = POPULAR_ETFS.map((e) => e.symbol);

  const latestBySymbol = new Map();
  for (const sym of symbols) {
    const p = await HistoricalPrice.findOne({
      where: { symbol: sym },
      order: [["date", "DESC"]],
      attributes: ["close"],
      raw: true,
    });
    if (p) latestBySymbol.set(sym, parseFloat(p.close));
  }

  const stocks = await Stock.findAll({
    where: { symbol: { [Op.in]: symbols } },
    attributes: ["symbol", "name"],
    raw: true,
  });
  const stockMap = new Map(stocks.map((s) => [s.symbol, s]));

  return POPULAR_ETFS.map((e) => ({
    symbol: e.symbol,
    name: stockMap.get(e.symbol)?.name ?? e.name,
    price: latestBySymbol.get(e.symbol) ?? null,
  }));
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

  const staticInfo = POPULAR_ETFS.find((e) => e.symbol === sym);

  if (!stock && !staticInfo) return null;

  return {
    symbol: sym,
    name: stock?.name ?? staticInfo?.name ?? sym,
    type: "ETF",
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
