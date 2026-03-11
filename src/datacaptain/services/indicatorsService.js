/**
 * Technical indicators service
 * RSI, SMA, EMA, MACD, Bollinger Bands
 * Calculated from historical_prices
 */

import { HistoricalPrice } from "../models/index.js";
import { Op } from "sequelize";

const DEFAULT_PERIOD = 14;
const BB_MULT = 2;

async function getCloses(symbol, limit = 100) {
  const rows = await HistoricalPrice.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["date", "DESC"]],
    limit,
    attributes: ["date", "close", "high", "low"],
    raw: true,
  });
  return rows.reverse().map((r) => ({
    date: r.date,
    close: parseFloat(r.close),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
  }));
}

function sma(values, period) {
  if (!values || values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values, period) {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i] * k + emaVal * (1 - k);
  }
  return emaVal;
}

export async function getIndicators(symbol, options = {}) {
  const {
    rsiPeriod = DEFAULT_PERIOD,
    smaPeriod = 20,
    emaPeriod = 20,
    macdFast = 12,
    macdSlow = 26,
    macdSignal = 9,
    bbPeriod = 20,
  } = options;

  const bars = await getCloses(symbol, 100);
  if (bars.length < 2) return null;

  const closes = bars.map((b) => b.close);

  // RSI
  let rsi = null;
  if (closes.length >= rsiPeriod + 1) {
    const gains = [];
    const losses = [];
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    const avgGain = gains.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
    const avgLoss = losses.slice(-rsiPeriod).reduce((a, b) => a + b, 0) / rsiPeriod;
    if (avgLoss > 0) {
      const rs = avgGain / avgLoss;
      rsi = 100 - 100 / (1 + rs);
    } else {
      rsi = 100;
    }
  }

  // SMA
  const smaVal = sma(closes, smaPeriod);

  // EMA
  const emaVal = ema(closes, emaPeriod);

  // MACD
  let macd = null;
  if (closes.length >= macdSlow) {
    const emaFast = ema(closes, macdFast);
    const emaSlow = ema(closes, macdSlow);
    const macdLine = emaFast - emaSlow;

    const macdValues = [];
    for (let i = macdSlow; i <= closes.length; i++) {
      const slice = closes.slice(0, i);
      const ef = ema(slice, macdFast);
      const es = ema(slice, macdSlow);
      macdValues.push(ef - es);
    }
    const signalLine =
      macdValues.length >= macdSignal
        ? ema(macdValues, macdSignal)
        : macdLine;
    const histogram = macdLine - signalLine;

    macd = {
      macdLine,
      signalLine,
      histogram,
    };
  }

  // Bollinger Bands
  let bollinger = null;
  if (closes.length >= bbPeriod) {
    const mid = sma(closes, bbPeriod);
    const slice = closes.slice(-bbPeriod);
    const variance =
      slice.reduce((s, c) => s + Math.pow(c - mid, 2), 0) / bbPeriod;
    const stdDev = Math.sqrt(variance);
    bollinger = {
      upper: mid + BB_MULT * stdDev,
      middle: mid,
      lower: mid - BB_MULT * stdDev,
      bandwidth: (BB_MULT * stdDev * 2) / mid,
    };
  }

  const lastDate = bars[bars.length - 1]?.date;

  return {
    symbol: symbol.toUpperCase(),
    date: lastDate,
    rsi: rsi != null ? Math.round(rsi * 100) / 100 : null,
    sma: smaVal != null ? Math.round(smaVal * 100) / 100 : null,
    ema: emaVal != null ? Math.round(emaVal * 100) / 100 : null,
    macd,
    bollingerBands: bollinger,
  };
}
