/**
 * Multi-strategy ETF backtest & portfolio comparison
 */

import { Op } from "sequelize";
import { HistoricalPrice, Stock, Dividend } from "../models/index.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import {
  SUPPORTED_STRATEGIES,
  simulateBuyAndHold,
  simulateDca,
  simulateSmaCrossover,
  simulateEmaCrossover,
  simulateRsi,
  simulateMacd,
  simulateCustom,
  addCalendarDays,
} from "./backtestStrategies.js";

const MAX_RANGE_YEARS = 30;
const MAX_COMPARE_SYMBOLS = 10;
const RISK_FREE_ANNUAL = 0.04;
const DEFAULT_INFLATION = 0.025;
const WARMUP_CALENDAR_DAYS = 400;

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

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4pct(n) {
  return Math.round(n * 10000) / 100;
}

function parseBool(value, defaultValue) {
  if (value === undefined || value === null || value === "") return defaultValue;
  if (typeof value === "boolean") return value;
  const s = String(value).toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return defaultValue;
}

function parseNum(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
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
    attributes: ["date", "open", "high", "low", "close", "volume"],
    raw: true,
    limit: 12000,
  });

  return rows.map((r) => ({
    date: typeof r.date === "string" ? r.date : r.date.toISOString().slice(0, 10),
    open: parseFloat(r.open),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
    close: parseFloat(r.close),
    volume: r.volume != null ? Number(r.volume) : 0,
  }));
}

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

async function getPriceDateBounds(symbol) {
  const sym = symbol.toUpperCase();
  const [first, last] = await Promise.all([
    HistoricalPrice.findOne({
      where: { symbol: sym },
      order: [["date", "ASC"]],
      attributes: ["date"],
      raw: true,
    }),
    HistoricalPrice.findOne({
      where: { symbol: sym },
      order: [["date", "DESC"]],
      attributes: ["date"],
      raw: true,
    }),
  ]);

  return {
    first: formatDateOnly(first?.date),
    last: formatDateOnly(last?.date),
  };
}

async function assertEnoughPriceHistory(symbol, startDate, endDate, prices) {
  if (prices.length >= 2) return;

  const bounds = await getPriceDateBounds(symbol);
  if (!bounds.first || !bounds.last) {
    throw new ValidationError(
      `No historical prices found for ${symbol.toUpperCase()}. Sync or seed market data before running backtests.`
    );
  }

  throw new ValidationError(
    `Not enough price history for ${startDate} to ${endDate}. ` +
      `${symbol.toUpperCase()} data is available from ${bounds.first} to ${bounds.last}.`
  );
}

async function loadDividends(symbol, startDate, endDate) {
  const dividends = await Dividend.findAll({
    where: {
      symbol: symbol.toUpperCase(),
      ex_date: { [Op.between]: [startDate, endDate] },
    },
    attributes: ["ex_date", "amount"],
    order: [["ex_date", "ASC"]],
    raw: true,
  });

  return dividends.map((d) => ({
    date: formatDateOnly(d.ex_date),
    amount: parseFloat(d.amount),
  }));
}

async function estimateDividendYield(symbol, startDate, endDate, startPrice) {
  const dividends = await loadDividends(symbol, startDate, endDate);
  if (!dividends.length || !startPrice) return null;

  const totalDividends = dividends.reduce((sum, d) => sum + d.amount, 0);
  const years = yearsBetween(startDate, endDate);
  const annualDividend = totalDividends / years;
  return round4pct(annualDividend / startPrice);
}

function riskMetricsFromDailyReturns(dailyReturns) {
  const n = dailyReturns.length;
  if (n < 2) {
    return { volatility: 0, sharpe: null, sortino: null };
  }

  const mean = dailyReturns.reduce((a, b) => a + b, 0) / n;
  const variance = dailyReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (n - 1);
  const volatility = Math.sqrt(variance) * Math.sqrt(252);

  const rfDaily = RISK_FREE_ANNUAL / 252;
  const excess = mean - rfDaily;
  const sharpe = volatility > 0 ? (excess / Math.sqrt(variance)) * Math.sqrt(252) : null;

  const downside = dailyReturns.filter((r) => r < rfDaily);
  let sortino = null;
  if (downside.length > 1) {
    const downVar =
      downside.reduce((s, r) => s + (r - rfDaily) ** 2, 0) / (downside.length - 1);
    const downDev = Math.sqrt(downVar);
    sortino = downDev > 0 ? (excess / downDev) * Math.sqrt(252) : null;
  }

  return {
    volatility: round4pct(volatility),
    sharpe: sharpe == null ? null : round2(sharpe),
    sortino: sortino == null ? null : round2(sortino),
  };
}

function metricsFromSimulation(sim, { adjustForInflation = false, inflationRate = DEFAULT_INFLATION, reinvestDividends = true, prices = [] } = {}) {
  const { equityCurve, totalInvested, startPrice, endPrice, trades, tradeEvents, dividendEvents, strategyParams } = sim;
  const startDate = equityCurve[0].date;
  const endDate = equityCurve[equityCurve.length - 1].date;
  const finalValue = equityCurve[equityCurve.length - 1].value;
  const invested = totalInvested > 0 ? totalInvested : 1;
  const years = yearsBetween(startDate, endDate);

  let peakValue = equityCurve[0].value;
  let maxDrawdown = 0;
  const dailyReturns = [];
  const drawdownCurve = [];
  let troughIndex = 0;
  let maxDdPeak = peakValue;
  let maxDdTroughValue = peakValue;

  for (let i = 0; i < equityCurve.length; i++) {
    const value = equityCurve[i].value;
    if (value > peakValue) peakValue = value;
    const dd = peakValue > 0 ? (peakValue - value) / peakValue : 0;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
      maxDdPeak = peakValue;
      maxDdTroughValue = value;
      troughIndex = i;
    }
    drawdownCurve.push({
      date: equityCurve[i].date,
      drawdown: round4pct(dd),
      peak: round2(peakValue),
      value: round2(value),
    });
    if (i > 0) {
      const prev = equityCurve[i - 1].value;
      if (prev > 0) dailyReturns.push((value - prev) / prev);
    }
  }

  // Recovery days: from trough of max DD until equity recovers to that peak (or remaining days)
  let recoveryDays = null;
  if (maxDrawdown > 0) {
    let recovered = false;
    for (let i = troughIndex; i < equityCurve.length; i++) {
      if (equityCurve[i].value >= maxDdPeak) {
        recoveryDays = i - troughIndex;
        recovered = true;
        break;
      }
    }
    if (!recovered) recoveryDays = equityCurve.length - 1 - troughIndex;
  }

  const totalReturn = (finalValue - invested) / invested;
  const annualReturn = Math.pow(Math.max(finalValue / invested, 1e-12), 1 / years) - 1;
  const totalProfit = finalValue - invested;
  const risk = riskMetricsFromDailyReturns(dailyReturns);

  let inflationAdjustedFinal = finalValue;
  let inflationAdjustedReturn = null;
  let inflationAdjustedCagr = null;
  if (adjustForInflation) {
    inflationAdjustedFinal = finalValue / Math.pow(1 + inflationRate, years);
    inflationAdjustedReturn = round4pct((inflationAdjustedFinal - invested) / invested);
    inflationAdjustedCagr = round4pct(Math.pow(inflationAdjustedFinal / invested, 1 / years) - 1);
  }

  const last = equityCurve[equityCurve.length - 1];
  const prev = equityCurve.length >= 2 ? equityCurve[equityCurve.length - 2] : null;
  const todayChange =
    prev && prev.value > 0 ? round2(last.value - prev.value) : null;
  const todayChangePct =
    prev && prev.value > 0 ? round4pct((last.value - prev.value) / prev.value) : null;

  return {
    startDate,
    endDate,
    startPrice,
    endPrice,
    initialInvestment: round2(invested),
    finalValue: round2(finalValue),
    totalProfit: round2(totalProfit),
    totalReturn: round4pct(totalReturn),
    annualReturn: round4pct(annualReturn),
    cagr: round4pct(annualReturn),
    maxDrawdown: round4pct(maxDrawdown),
    maxDrawdownRecoveryDays: recoveryDays,
    volatility: risk.volatility,
    sharpe: risk.sharpe,
    sortino: risk.sortino,
    riskScore: Math.min(100, Math.round(risk.volatility)),
    tradingDays: equityCurve.length,
    years: round2(years),
    trades,
    tradeEvents: tradeEvents || [],
    dividendEvents: dividendEvents || [],
    prices,
    drawdownCurve,
    todayChange,
    todayChangePct,
    reinvestDividends: Boolean(reinvestDividends),
    adjustForInflation: Boolean(adjustForInflation),
    inflationRate: adjustForInflation ? inflationRate : null,
    inflationAdjustedFinalValue: adjustForInflation ? round2(inflationAdjustedFinal) : null,
    inflationAdjustedReturn,
    inflationAdjustedCagr,
    strategyParams,
    equityCurve,
  };
}

function needsWarmup(strategy) {
  return ["sma_crossover", "ema_crossover", "rsi", "macd", "custom"].includes(strategy);
}

function runStrategySimulator(strategy, rangePrices, allPrices, rangeStart, investment, opts) {
  switch (strategy) {
    case "buy_and_hold":
      return simulateBuyAndHold(rangePrices, investment, opts);
    case "dca":
      return simulateDca(rangePrices, investment, opts);
    case "sma_crossover":
      return simulateSmaCrossover(allPrices, rangeStart, investment, opts);
    case "ema_crossover":
      return simulateEmaCrossover(allPrices, rangeStart, investment, opts);
    case "rsi":
      return simulateRsi(allPrices, rangeStart, investment, opts);
    case "macd":
      return simulateMacd(allPrices, rangeStart, investment, opts);
    case "custom":
      return simulateCustom(allPrices, rangeStart, investment, opts);
    default:
      throw new ValidationError(`Unsupported strategy: ${strategy}`);
  }
}

/**
 * @param {object} input
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

  const strategy = String(input.strategy || "buy_and_hold").toLowerCase();
  if (!SUPPORTED_STRATEGIES.includes(strategy)) {
    throw new ValidationError(
      `Unsupported strategy. Use one of: ${SUPPORTED_STRATEGIES.join(", ")}`
    );
  }

  const reinvestDividends = parseBool(input.reinvestDividends, true);
  const adjustForInflation = parseBool(input.adjustForInflation, false);

  const strategyOpts = {
    dividends: [],
    reinvestDividends,
    fastPeriod: parseNum(input.fastPeriod, strategy === "custom" ? 10 : strategy === "ema_crossover" ? 12 : 20),
    slowPeriod: parseNum(input.slowPeriod, strategy === "custom" ? 30 : strategy === "ema_crossover" ? 26 : 50),
    rsiPeriod: parseNum(input.rsiPeriod, 14),
    rsiBuyBelow: parseNum(input.rsiBuyBelow, 30),
    rsiSellAbove: parseNum(input.rsiSellAbove, 70),
    macdFast: parseNum(input.macdFast, 12),
    macdSlow: parseNum(input.macdSlow, 26),
    macdSignal: parseNum(input.macdSignal, 9),
  };

  const stock = await assertSymbol(symbol);

  const loadFrom = needsWarmup(strategy) ? addCalendarDays(startDate, -WARMUP_CALENDAR_DAYS) : startDate;
  const allPrices = await loadPriceSeries(symbol, loadFrom, endDate);
  const rangeStart = allPrices.findIndex((p) => p.date >= startDate);
  if (rangeStart < 0) {
    await assertEnoughPriceHistory(symbol, startDate, endDate, []);
  }
  const rangePrices = allPrices.slice(rangeStart);
  await assertEnoughPriceHistory(symbol, startDate, endDate, rangePrices);

  const dividends = await loadDividends(
    symbol,
    rangePrices[0].date,
    rangePrices[rangePrices.length - 1].date
  );
  strategyOpts.dividends = dividends;

  const sim = runStrategySimulator(
    strategy,
    rangePrices,
    allPrices,
    rangeStart,
    investment,
    strategyOpts
  );

  const metrics = metricsFromSimulation(sim, {
    adjustForInflation,
    reinvestDividends,
    prices: rangePrices,
  });

  const dividendYield = await estimateDividendYield(
    symbol,
    metrics.startDate,
    metrics.endDate,
    metrics.startPrice
  );

  return {
    strategy,
    symbol,
    name: stock.name,
    type: stock.type,
    ...metrics,
    dividendYield,
  };
}

/**
 * Compare multiple symbols with the same strategy settings.
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
  const reinvestDividends = parseBool(input.reinvestDividends, true);
  const adjustForInflation = parseBool(input.adjustForInflation, false);
  const strategy = String(input.strategy || "buy_and_hold").toLowerCase();

  const results = [];
  for (const symbol of symbols) {
    try {
      const row = await runBuyAndHoldBacktest({
        symbol,
        investment,
        startDate,
        endDate,
        strategy,
        reinvestDividends,
        adjustForInflation,
        fastPeriod: input.fastPeriod,
        slowPeriod: input.slowPeriod,
        rsiPeriod: input.rsiPeriod,
        rsiBuyBelow: input.rsiBuyBelow,
        rsiSellAbove: input.rsiSellAbove,
        macdFast: input.macdFast,
        macdSlow: input.macdSlow,
        macdSignal: input.macdSignal,
      });
      results.push({
        symbol: row.symbol,
        name: row.name,
        strategy: row.strategy,
        totalReturn: row.totalReturn,
        annualReturn: row.annualReturn,
        cagr: row.cagr,
        maxDrawdown: row.maxDrawdown,
        finalValue: row.finalValue,
        totalProfit: row.totalProfit,
        dividendYield: row.dividendYield,
        riskScore: row.riskScore,
        sharpe: row.sharpe,
        sortino: row.sortino,
        volatility: row.volatility,
        equityCurve: row.equityCurve,
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
    strategy,
    results,
    winner: ranked[0]?.symbol ?? null,
    ranked: ranked.map((r) => r.symbol),
  };
}
