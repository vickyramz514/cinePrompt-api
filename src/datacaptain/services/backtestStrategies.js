/**
 * Backtest strategy simulators.
 * Each returns { equityCurve, totalInvested, trades, tradeEvents, dividendEvents, strategyParams, startPrice, endPrice }
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

function round4(n) {
  return Math.round(n * 10000) / 10000;
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
  if (!divPerShare || divPerShare <= 0 || shares <= 0) {
    return { shares, cash, cashReceived: 0, reinvestedShares: 0, income: 0 };
  }
  const income = shares * divPerShare;
  if (reinvest && price > 0) {
    const reinvestedShares = income / price;
    return {
      shares: shares + reinvestedShares,
      cash,
      cashReceived: 0,
      reinvestedShares: round4(reinvestedShares),
      income: round2(income),
    };
  }
  return {
    shares,
    cash: cash + income,
    cashReceived: round2(income),
    reinvestedShares: 0,
    income: round2(income),
  };
}

function finalizeCurve(
  equityCurve,
  totalInvested,
  startPrice,
  endPrice,
  tradeEvents,
  dividendEvents,
  strategyParams
) {
  if (equityCurve.length < 2) {
    throw new ValidationError("Not enough price history for this strategy / date range");
  }
  return {
    equityCurve,
    totalInvested: round2(totalInvested),
    startPrice: round2(startPrice),
    endPrice: round2(endPrice),
    trades: tradeEvents.length,
    tradeEvents,
    dividendEvents,
    strategyParams,
  };
}

function pushTrade(events, { date, side, price, shares, amount, portfolioValue }) {
  events.push({
    date,
    side,
    price: round2(price),
    shares: round4(shares),
    amount: round2(amount),
    portfolioValue: round2(portfolioValue),
  });
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
  const tradeEvents = [];
  const dividendEvents = [];

  pushTrade(tradeEvents, {
    date: prices[0].date,
    side: "BUY",
    price: prices[0].close,
    shares,
    amount: investment,
    portfolioValue: investment,
  });

  for (const p of prices) {
    const div = divByDate.get(p.date) || 0;
    if (div > 0) {
      const before = shares;
      const applied = applyDividends(shares, cash, p.close, div, reinvestDividends);
      shares = applied.shares;
      cash = applied.cash;
      dividendEvents.push({
        date: p.date,
        amountPerShare: round4(div),
        amount: applied.income,
        reinvestedShares: applied.reinvestedShares,
        cashReceived: applied.cashReceived,
        sharesBefore: round4(before),
        portfolioValue: round2(shares * p.close + cash),
      });
    }
    equityCurve.push({ date: p.date, value: round2(shares * p.close + cash) });
  }

  return finalizeCurve(
    equityCurve,
    investment,
    prices[0].close,
    prices[prices.length - 1].close,
    tradeEvents,
    dividendEvents,
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
  const equityCurve = [];
  const tradeEvents = [];
  const dividendEvents = [];

  for (const p of prices) {
    const m = p.date.slice(0, 7);
    if (m !== lastMonth) {
      cash += contribution;
      invested += contribution;
      if (p.close > 0) {
        const bought = cash / p.close;
        shares += bought;
        pushTrade(tradeEvents, {
          date: p.date,
          side: "BUY",
          price: p.close,
          shares: bought,
          amount: cash,
          portfolioValue: shares * p.close,
        });
        cash = 0;
      }
      lastMonth = m;
    }

    const div = divByDate.get(p.date) || 0;
    if (div > 0 && shares > 0) {
      const before = shares;
      const applied = applyDividends(shares, cash, p.close, div, reinvestDividends);
      shares = applied.shares;
      cash = applied.cash;
      dividendEvents.push({
        date: p.date,
        amountPerShare: round4(div),
        amount: applied.income,
        reinvestedShares: applied.reinvestedShares,
        cashReceived: applied.cashReceived,
        sharesBefore: round4(before),
        portfolioValue: round2(shares * p.close + cash),
      });
    }
    equityCurve.push({ date: p.date, value: round2(shares * p.close + cash) });
  }

  return finalizeCurve(
    equityCurve,
    invested,
    prices[0].close,
    prices[prices.length - 1].close,
    tradeEvents,
    dividendEvents,
    { contributionPerMonth: round2(contribution), months: monthCount }
  );
}

/**
 * Long/flat signal strategy: when signal goes true, buy with all cash;
 * when false, sell all shares to cash.
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
  let position = false;
  const equityCurve = [];
  const tradeEvents = [];
  const dividendEvents = [];

  for (let i = rangeStart; i < allPrices.length; i++) {
    const p = allPrices[i];
    const wantLong = Boolean(signalAt(i));

    if (wantLong && !position && cash > 0 && p.close > 0) {
      shares = cash / p.close;
      const amount = cash;
      cash = 0;
      position = true;
      pushTrade(tradeEvents, {
        date: p.date,
        side: "BUY",
        price: p.close,
        shares,
        amount,
        portfolioValue: shares * p.close + cash,
      });
    } else if (!wantLong && position && p.close > 0) {
      const amount = shares * p.close;
      const soldShares = shares;
      cash = amount;
      shares = 0;
      position = false;
      pushTrade(tradeEvents, {
        date: p.date,
        side: "SELL",
        price: p.close,
        shares: soldShares,
        amount,
        portfolioValue: cash,
      });
    }

    const div = divByDate.get(p.date) || 0;
    if (position && div > 0) {
      const before = shares;
      const applied = applyDividends(shares, cash, p.close, div, reinvestDividends);
      shares = applied.shares;
      cash = applied.cash;
      dividendEvents.push({
        date: p.date,
        amountPerShare: round4(div),
        amount: applied.income,
        reinvestedShares: applied.reinvestedShares,
        cashReceived: applied.cashReceived,
        sharesBefore: round4(before),
        portfolioValue: round2(shares * p.close + cash),
      });
    }

    equityCurve.push({ date: p.date, value: round2(shares * p.close + cash) });
  }

  const rangePrices = allPrices.slice(rangeStart);
  return finalizeCurve(
    equityCurve,
    invested,
    rangePrices[0].close,
    rangePrices[rangePrices.length - 1].close,
    tradeEvents,
    dividendEvents,
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
    fastPeriod: opts.fastPeriod ?? 10,
    slowPeriod: opts.slowPeriod ?? 30,
  });
}

export function addCalendarDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
