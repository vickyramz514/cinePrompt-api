/**
 * AI Stock Score service
 * Returns 0-100 score based on trend, momentum, volume, volatility
 * Uses historical_prices data
 */

import { HistoricalPrice } from "../models/index.js";

const LOOKBACK_DAYS = 30;
const LOOKBACK_MOMENTUM = 14;

async function getPriceHistory(symbol, days = LOOKBACK_DAYS) {
  const rows = await HistoricalPrice.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["date", "DESC"]],
    limit: days,
    attributes: ["date", "close", "high", "low", "volume"],
    raw: true,
  });
  return rows.reverse().map((r) => ({
    date: r.date,
    close: parseFloat(r.close),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
    volume: r.volume ? Number(r.volume) : 0,
  }));
}

function linearRegressionSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den !== 0 ? num / den : 0;
}

export async function getStockScore(symbol) {
  const bars = await getPriceHistory(symbol, LOOKBACK_DAYS);
  if (bars.length < LOOKBACK_MOMENTUM) return null;

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  // Trend: linear regression slope of closes (normalized to 0-25)
  const slope = linearRegressionSlope(closes);
  const avgPrice = closes.reduce((a, b) => a + b, 0) / closes.length;
  const slopePercent = avgPrice > 0 ? (slope / avgPrice) * 100 : 0;
  const trendScore = Math.max(0, Math.min(25, 12.5 + slopePercent * 2.5));

  // Momentum: RSI-like but simpler - % price change over LOOKBACK_MOMENTUM days (0-25)
  const momentumChange =
    closes.length >= LOOKBACK_MOMENTUM
      ? ((closes[closes.length - 1] - closes[closes.length - LOOKBACK_MOMENTUM]) /
          closes[closes.length - LOOKBACK_MOMENTUM]) *
        100
      : 0;
  const momentumScore = Math.max(0, Math.min(25, 12.5 + momentumChange));

  // Volume: relative to average (0-25)
  const avgVol =
    volumes.reduce((a, b) => a + b, 0) / volumes.filter((v) => v > 0).length || 1;
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5 || avgVol;
  const volRatio = avgVol > 0 ? recentVol / avgVol : 1;
  const volumeScore = Math.max(0, Math.min(25, volRatio * 12.5));

  // Volatility: lower is better for score (0-25)
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
    }
  }
  const avgReturn =
    returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const variance =
    returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) /
    (returns.length || 1);
  const annualizedVol = Math.sqrt(variance * 252) * 100; // ~annualized %
  const volatilityScore = Math.max(0, Math.min(25, 25 - annualizedVol));

  const total =
    trendScore + momentumScore + volumeScore + volatilityScore;
  const score = Math.round(Math.max(0, Math.min(100, total)));

  return {
    symbol: symbol.toUpperCase(),
    score,
    components: {
      trend: Math.round(trendScore * 100) / 100,
      momentum: Math.round(momentumScore * 100) / 100,
      volume: Math.round(volumeScore * 100) / 100,
      volatility: Math.round(volatilityScore * 100) / 100,
    },
    summary:
      score >= 70
        ? "Strong"
        : score >= 50
          ? "Moderate"
          : score >= 30
            ? "Weak"
            : "Bearish",
  };
}
