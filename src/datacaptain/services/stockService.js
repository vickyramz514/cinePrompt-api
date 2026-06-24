/**
 * Stock data service - Fetches from DB
 */

import { Stock, HistoricalPrice, Company } from "../models/index.js";
import { Op } from "sequelize";
import { NotFoundError } from "../../utils/errors.js";

async function assertEtfSymbol(symbol) {
  const sym = symbol?.toUpperCase();
  const row = await Stock.findOne({
    where: { symbol: sym, type: "ETF" },
    attributes: ["symbol"],
    raw: true,
  });
  if (!row) {
    throw new NotFoundError(
      `ETF not found: ${sym}. Data Captain currently supports ETF symbols only.`
    );
  }
  return sym;
}

export async function getLatestPrice(symbol) {
  const sym = await assertEtfSymbol(symbol);
  const price = await HistoricalPrice.findOne({
    where: { symbol: sym },
    order: [["date", "DESC"]],
    raw: true,
  });
  if (!price) return null;

  const prev = await HistoricalPrice.findOne({
    where: { symbol: sym },
    order: [["date", "DESC"]],
    offset: 1,
    raw: true,
  });

  const change = prev ? parseFloat(price.close) - parseFloat(prev.close) : 0;
  const changePercent = prev ? (change / parseFloat(prev.close)) * 100 : 0;

  return {
    symbol: price.symbol,
    price: parseFloat(price.close),
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    timestamp: price.updated_at,
  };
}

export async function getHistory(symbol, startDate, endDate, interval = "1d") {
  const sym = await assertEtfSymbol(symbol);
  const where = { symbol: sym };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date[Op.gte] = startDate;
    if (endDate) where.date[Op.lte] = endDate;
  }

  let order = [["date", "ASC"]];
  let limit = 1000;

  if (interval === "1wk") limit = 200;
  if (interval === "1mo") limit = 120;

  const rows = await HistoricalPrice.findAll({
    where,
    order,
    limit,
    raw: true,
  });

  return rows.map((r) => ({
    date: r.date,
    open: parseFloat(r.open),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
    close: parseFloat(r.close),
    volume: r.volume ? Number(r.volume) : 0,
  }));
}

export async function getCandles(symbol, interval = "1d", limit = 100) {
  const sym = await assertEtfSymbol(symbol);
  const rows = await HistoricalPrice.findAll({
    where: { symbol: sym },
    order: [["date", "DESC"]],
    limit: Math.min(limit, 500),
    raw: true,
  });

  return rows.reverse().map((r) => ({
    date: r.date,
    open: parseFloat(r.open),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
    close: parseFloat(r.close),
    volume: r.volume ? Number(r.volume) : 0,
  }));
}

export async function getProfile(symbol) {
  const [company, stock] = await Promise.all([
    Company.findByPk(symbol.toUpperCase()),
    Stock.findByPk(symbol.toUpperCase()),
  ]);

  const name = company?.company_name || stock?.name || symbol;
  return {
    symbol: symbol.toUpperCase(),
    companyName: name,
    sector: company?.sector || "N/A",
    industry: company?.industry || "N/A",
    marketCap: company?.market_cap || null,
    exchange: company?.exchange || stock?.exchange_code || "N/A",
  };
}

export async function searchStocks(q) {
  const term = `%${q}%`;
  const stocks = await Stock.findAll({
    where: {
      type: "ETF",
      [Op.or]: [{ symbol: { [Op.iLike]: term } }, { name: { [Op.iLike]: term } }],
    },
    limit: 20,
    raw: true,
  });
  return stocks.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    type: s.type,
  }));
}
