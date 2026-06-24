/**
 * Buy-and-hold backtest & portfolio comparison
 */

import { Op } from "sequelize";
import { HistoricalPrice, Stock, Dividend } from "../models/index.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";

const MAX_RANGE_YEARS = 30;
const MAX_COMPARE_SYMBOLS = 10;

function parseDate(value, label) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new ValidationError(`Invalid ${label}`);
  }
  return d.toISOString().slice(0, 10);
}

function yearsBetween(start, end) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(ms / (365.25 * 24 * 60 * 60 * 1000), 1 / 365.25);
}

async function assertSymbol(symbol) {
  const sym = symbol?.toUpperCase();
  const row = await Stock.findOne({
    where: { symbol: sym, type: "ETF" },
    attributes: ["symbol", "name", "type"],
    raw: true,
  });
  if (!row) {
    throw new NotFoundError(
      `ETF not found: ${sym}. Data Captain currently supports ETF symbols only.`
    );
  }
  return row;
}

async function loadPriceSeries(symbol, startDate, endDate) {
  const rows = await HistoricalPrice.findAll({
    where: {
      symbol: symbol.toUpperCase(),
      date: { [Op.between]: [startDate, endDate] },
    },
    order: [["date", "ASC"]],
    attributes: ["date", "close"],
    raw: true,
    limit: 12000,
  });

  return rows.map((r) => ({
    date: typeof r.date === "string" ? r.date : r.date.toISOString().slice(0, 10),
    close: parseFloat(r.close),
  }));
}

async function estimateDividendYield(symbol, startDate, endDate, startPrice) {
  const dividends = await Dividend.findAll({
    where: {
      symbol: symbol.toUpperCase(),
      ex_date: { [Op.between]: [startDate, endDate] },
    },
    attributes: ["amount"],
    raw: true,
  });

  if (!dividends.length || !startPrice) return null;

  const totalDividends = dividends.reduce((sum, d) => sum + parseFloat(d.amount), 0);
  const years = yearsBetween(startDate, endDate);
  const annualDividend = totalDividends / years;
  return Math.round((annualDividend / startPrice) * 10000) / 100;
}

function computeMetrics(prices, investment) {
  if (prices.length < 2) {
    throw new ValidationError("Not enough price history for this date range");
  }

  const startPrice = prices[0].close;
  const endPrice = prices[prices.length - 1].close;
  const startDate = prices[0].date;
  const endDate = prices[prices.length - 1].date;

  const shares = investment / startPrice;
  const finalValue = shares * endPrice;
  const totalReturn = (finalValue - investment) / investment;
  const years = yearsBetween(startDate, endDate);
  const annualReturn = Math.pow(1 + totalReturn, 1 / years) - 1;

  let peak = prices[0].close;
  let maxDrawdown = 0;
  const equityCurve = [];

  const dailyReturns = [];
  for (let i = 0; i < prices.length; i++) {
    const p = prices[i];
    const value = investment * (p.close / startPrice);
    equityCurve.push({ date: p.date, value: Math.round(value * 100) / 100 });

    if (p.close > peak) peak = p.close;
    const dd = peak > 0 ? (peak - p.close) / peak : 0;
    if (dd > maxDrawdown) maxDrawdown = dd;

    if (i > 0) {
      const prev = prices[i - 1].close;
      if (prev > 0) dailyReturns.push((p.close - prev) / prev);
    }
  }

  const mean =
    dailyReturns.length > 0
      ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length
      : 0;
  const variance =
    dailyReturns.length > 1
      ? dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (dailyReturns.length - 1)
      : 0;
  const volatility = Math.sqrt(variance) * Math.sqrt(252);
  const riskScore = Math.min(100, Math.round(volatility * 100));

  return {
    startDate,
    endDate,
    startPrice: Math.round(startPrice * 100) / 100,
    endPrice: Math.round(endPrice * 100) / 100,
    initialInvestment: investment,
    finalValue: Math.round(finalValue * 100) / 100,
    totalReturn: Math.round(totalReturn * 10000) / 100,
    annualReturn: Math.round(annualReturn * 10000) / 100,
    maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
    volatility: Math.round(volatility * 10000) / 100,
    riskScore,
    equityCurve,
  };
}

/**
 * @param {{ symbol: string, investment?: number, startDate: string, endDate: string, strategy?: string }} input
 */
export async function runBuyAndHoldBacktest(input) {
  const symbol = input.symbol?.toUpperCase();
  if (!symbol) throw new ValidationError("symbol is required");

  const investment = Number(input.investment ?? 10000);
  if (!Number.isFinite(investment) || investment <= 0) {
    throw new ValidationError("investment must be a positive number");
  }

  const startDate = parseDate(input.startDate, "startDate");
  const endDate = parseDate(input.endDate, "endDate");
  if (startDate >= endDate) {
    throw new ValidationError("startDate must be before endDate");
  }
  if (yearsBetween(startDate, endDate) > MAX_RANGE_YEARS) {
    throw new ValidationError(`Date range cannot exceed ${MAX_RANGE_YEARS} years`);
  }

  const strategy = input.strategy || "buy_and_hold";
  if (strategy !== "buy_and_hold") {
    throw new ValidationError("Only buy_and_hold strategy is supported in this version");
  }

  const stock = await assertSymbol(symbol);
  const prices = await loadPriceSeries(symbol, startDate, endDate);
  const metrics = computeMetrics(prices, investment);
  const dividendYield = await estimateDividendYield(
    symbol,
    metrics.startDate,
    metrics.endDate,
    metrics.startPrice
  );

  return {
    strategy: "buy_and_hold",
    symbol,
    name: stock.name,
    type: stock.type,
    ...metrics,
    dividendYield,
  };
}

/**
 * Compare multiple symbols (e.g. VOO vs SPY vs QQQ)
 */
export async function compareBuyAndHold(input) {
  const symbols = (input.symbols || [])
    .map((s) => String(s).trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length < 2) {
    throw new ValidationError("Provide at least 2 symbols to compare");
  }
  if (symbols.length > MAX_COMPARE_SYMBOLS) {
    throw new ValidationError(`Maximum ${MAX_COMPARE_SYMBOLS} symbols per comparison`);
  }

  const investment = Number(input.investment ?? 10000);
  const startDate = parseDate(input.startDate, "startDate");
  const endDate = parseDate(input.endDate, "endDate");

  const results = [];
  for (const symbol of symbols) {
    try {
      const row = await runBuyAndHoldBacktest({
        symbol,
        investment,
        startDate,
        endDate,
        strategy: "buy_and_hold",
      });
      results.push({
        symbol: row.symbol,
        name: row.name,
        totalReturn: row.totalReturn,
        annualReturn: row.annualReturn,
        maxDrawdown: row.maxDrawdown,
        finalValue: row.finalValue,
        dividendYield: row.dividendYield,
        riskScore: row.riskScore,
      });
    } catch (err) {
      results.push({
        symbol,
        error: err.message || "Backtest failed",
      });
    }
  }

  const ranked = [...results]
    .filter((r) => !r.error)
    .sort((a, b) => b.totalReturn - a.totalReturn);

  return {
    investment,
    startDate,
    endDate,
    results,
    winner: ranked[0]?.symbol ?? null,
    ranked: ranked.map((r) => r.symbol),
  };
}
