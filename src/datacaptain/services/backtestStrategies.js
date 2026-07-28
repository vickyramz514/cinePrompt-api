/**
 * Backtest strategy simulators.
 * Each returns { equityCurve, totalInvested, trades, strategyParams, startPrice, endPrice }
 * for the in-range price series (first point = first trading day in range).
 */

import { ValidationError } from "../../utils/errors.js";

export const SUPPORTED_STRATEGIES = [
  "buy_and_hold",
  "dca",
  "sma_crossover",
  "ema_crossover",
  "rsi",
  "macd",
  "custom",
];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function sma(closes, period, i) {
  if (i + 1 < period) return null;
  let sum = 0;
  for (let j = i - period + 1; j <= i; j++) sum += closes[j];
  return sum / period;
}

function emaSeries(closes, period) {
  const out = new Array(closes.length).fill(null);
  if (closes.length < period) return out;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += closes[i];
  out[period - 1] = sum / period;
  const k = 2 / (period + 1);
  for (let i = period; i < closes.length; i++) {
    out[i] = closes[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

function rsiSeries(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

function applyDividends(shares, cash, price, divPerShare, reinvest) {
  if (!divPerShare || divPerShare <= 0 || shares <= 0) return { shares, cash };
  const income = shares * divPerShare;
  if (reinvest && price > 0) {
    return { shares: shares + income / price, cash };
  }
  return { shares, cash: cash + income };
}

function finalizeCurve(equityCurve, totalInvested, startPrice, endPrice, trades, strategyParams) {
  if (equityCurve.length < 2) {
    throw new ValidationError("Not enough price history for this strategy / date range");
  }
  return {
    equityCurve,
    totalInvested: round2(totalInvested),
    startPrice: round2(startPrice),
    endPrice: round2(endPrice),
    trades,
    strategyParams,
  };
}

/** Buy & hold — deploy all capital on day 1. */
export function simulateBuyAndHold(prices, investment, { dividends = [], reinvestDividends = true } = {}) {
  const divByDate = new Map();
  for (const d of dividends) {
    if (!d.date) continue;
    divByDate.set(d.date, (divByDate.get(d.date) || 0) + d.amount);
  }

  let shares = investment / prices[0].close;
  let cash = 0;
  const equityCurve = [];
  let trades = 1;

  for (const p of prices) {
    const div = divByDate.get(p.date) || 0;
    ({ shares, cash } = applyDividends(shares, cash, p.close, div, reinvestDividends));
    equityCurve.push({ date: p.date, value: round2(shares * p.close + cash) });
  }

  return finalizeCurve(
    equityCurve,
    investment,
    prices[0].close,
    prices[prices.length - 1].close,
    trades,
    { mode: "lump_sum" }
  );
}

/**
 * DCA — split total investment across calendar months (equal contributions).
 */
export function simulateDca(prices, investment, { dividends = [], reinvestDividends = true } = {}) {
  const months = new Set(prices.map((p) => p.date.slice(0, 7)));
  const monthCount = Math.max(months.size, 1);
  const contribution = investment / monthCount;

  const divByDate = new Map();
  for (const d of dividends) {
    if (!d.date) continue;
    divByDate.set(d.date, (divByDate.get(d.date) || 0) + d.amount);
  }

  let shares = 0;
  let cash = 0;
  let invested = 0;
  let lastMonth = null;
  let trades = 0;
  const equityCurve = [];

  for (const p of prices) {
    const m = p.date.slice(0, 7);
    if (m !== lastMonth) {
      cash += contribution;
      invested += contribution;
      if (p.close > 0) {
        shares += cash / p.close;
        cash = 0;
        trades += 1;
      }
      lastMonth = m;
    }

    const div = divByDate.get(p.date) || 0;
    ({ shares, cash } = applyDividends(shares, cash, p.close, div, reinvestDividends));
    equityCurve.push({ date: p.date, value: round2(shares * p.close + cash) });
  }

  return finalizeCurve(
    equityCurve,
    invested,
    prices[0].close,
    prices[prices.length - 1].close,
    trades,
    { contributionPerMonth: round2(contribution), months: monthCount }
  );
}

/**
 * Long/flat signal strategy: when signal goes true, buy with all cash;
 * when false, sell all shares to cash.
 * `signalAt(i)` uses full series index (including warmup).
 * `rangeStart` is first index of the reported range.
 */
function simulateSignalStrategy(
  allPrices,
  rangeStart,
  investment,
  signalAt,
  { dividends = [], reinvestDividends = true, strategyParams = {} } = {}
) {
  const divByDate = new Map();
  for (const d of dividends) {
    if (!d.date) continue;
    divByDate.set(d.date, (divByDate.get(d.date) || 0) + d.amount);
  }

  let shares = 0;
  let cash = investment;
  let invested = investment;
  let trades = 0;
  let position = false;
  const equityCurve = [];

  for (let i = rangeStart; i < allPrices.length; i++) {
    const p = allPrices[i];
    const wantLong = Boolean(signalAt(i));

    if (wantLong && !position && cash > 0 && p.close > 0) {
      shares = cash / p.close;
      cash = 0;
      position = true;
      trades += 1;
    } else if (!wantLong && position && p.close > 0) {
      cash = shares * p.close;
      shares = 0;
      position = false;
      trades += 1;
    }

    const div = divByDate.get(p.date) || 0;
    if (position) {
      ({ shares, cash } = applyDividends(shares, cash, p.close, div, reinvestDividends));
    }

    equityCurve.push({ date: p.date, value: round2(shares * p.close + cash) });
  }

  const rangePrices = allPrices.slice(rangeStart);
  return finalizeCurve(
    equityCurve,
    invested,
    rangePrices[0].close,
    rangePrices[rangePrices.length - 1].close,
    trades,
    strategyParams
  );
}

export function simulateSmaCrossover(allPrices, rangeStart, investment, opts = {}) {
  const fast = Number(opts.fastPeriod ?? 20);
  const slow = Number(opts.slowPeriod ?? 50);
  if (!(fast > 0 && slow > fast)) {
    throw new ValidationError("SMA crossover requires slowPeriod > fastPeriod > 0");
  }
  const closes = allPrices.map((p) => p.close);

  const signalAt = (i) => {
    const f = sma(closes, fast, i);
    const s = sma(closes, slow, i);
    if (f == null || s == null) return false;
    return f > s;
  };

  return simulateSignalStrategy(allPrices, rangeStart, investment, signalAt, {
    ...opts,
    strategyParams: { fastPeriod: fast, slowPeriod: slow, indicator: "sma" },
  });
}

export function simulateEmaCrossover(allPrices, rangeStart, investment, opts = {}) {
  const fast = Number(opts.fastPeriod ?? 12);
  const slow = Number(opts.slowPeriod ?? 26);
  if (!(fast > 0 && slow > fast)) {
    throw new ValidationError("EMA crossover requires slowPeriod > fastPeriod > 0");
  }
  const closes = allPrices.map((p) => p.close);
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);

  const signalAt = (i) => {
    if (fastE[i] == null || slowE[i] == null) return false;
    return fastE[i] > slowE[i];
  };

  return simulateSignalStrategy(allPrices, rangeStart, investment, signalAt, {
    ...opts,
    strategyParams: { fastPeriod: fast, slowPeriod: slow, indicator: "ema" },
  });
}

export function simulateRsi(allPrices, rangeStart, investment, opts = {}) {
  const period = Number(opts.rsiPeriod ?? 14);
  const buyBelow = Number(opts.rsiBuyBelow ?? 30);
  const sellAbove = Number(opts.rsiSellAbove ?? 70);
  const closes = allPrices.map((p) => p.close);
  const rsi = rsiSeries(closes, period);

  // Sticky: enter when RSI rises through buyBelow; exit when falls through sellAbove
  let long = false;
  const signalAt = (i) => {
    const cur = rsi[i];
    const prev = rsi[i - 1];
    if (cur == null) return long;
    if (prev != null && prev < buyBelow && cur >= buyBelow) long = true;
    if (prev != null && prev > sellAbove && cur <= sellAbove) long = false;
    return long;
  };

  return simulateSignalStrategy(allPrices, rangeStart, investment, signalAt, {
    ...opts,
    strategyParams: { rsiPeriod: period, rsiBuyBelow: buyBelow, rsiSellAbove: sellAbove },
  });
}

export function simulateMacd(allPrices, rangeStart, investment, opts = {}) {
  const fast = Number(opts.macdFast ?? 12);
  const slow = Number(opts.macdSlow ?? 26);
  const signalPeriod = Number(opts.macdSignal ?? 9);
  const closes = allPrices.map((p) => p.close);
  const emaFast = emaSeries(closes, fast);
  const emaSlow = emaSeries(closes, slow);
  const macdLine = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );

  // Signal EMA on MACD line (skip nulls by building compact then map back)
  const compact = [];
  const compactIdx = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] != null) {
      compact.push(macdLine[i]);
      compactIdx.push(i);
    }
  }
  const sigCompact = emaSeries(compact, signalPeriod);
  const signal = new Array(closes.length).fill(null);
  for (let j = 0; j < compactIdx.length; j++) {
    signal[compactIdx[j]] = sigCompact[j];
  }

  const signalAt = (i) => {
    if (macdLine[i] == null || signal[i] == null) return false;
    return macdLine[i] > signal[i];
  };

  return simulateSignalStrategy(allPrices, rangeStart, investment, signalAt, {
    ...opts,
    strategyParams: { macdFast: fast, macdSlow: slow, macdSignal: signalPeriod },
  });
}

/** Custom = user-tunable SMA crossover (defaults 10/30). */
export function simulateCustom(allPrices, rangeStart, investment, opts = {}) {
  return simulateSmaCrossover(allPrices, rangeStart, investment, {
    ...opts,
    fastPeriod: Number(opts.fastPeriod ?? 10),
    slowPeriod: Number(opts.slowPeriod ?? 30),
  });
}

export function addCalendarDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
