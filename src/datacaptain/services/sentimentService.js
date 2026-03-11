/**
 * Stock Sentiment service - Aggregated news/signal sentiment
 */

import { StockSentiment } from "../models/index.js";

const SENTIMENT_THRESHOLDS = {
  BULLISH: 0.3,
  NEUTRAL_HIGH: 0,
  NEUTRAL_LOW: -0.3,
};

function getSentimentLabel(score) {
  const s = parseFloat(score);
  if (s >= SENTIMENT_THRESHOLDS.BULLISH) return "BULLISH";
  if (s > SENTIMENT_THRESHOLDS.NEUTRAL_HIGH) return "SLIGHTLY_BULLISH";
  if (s >= SENTIMENT_THRESHOLDS.NEUTRAL_LOW) return "NEUTRAL";
  if (s > -0.6) return "BEARISH";
  return "VERY_BEARISH";
}

export async function getSentiment(symbol) {
  const row = await StockSentiment.findOne({
    where: { symbol: symbol.toUpperCase() },
    raw: true,
  });

  if (!row) {
    return {
      symbol: symbol.toUpperCase(),
      sentimentScore: 0,
      sentiment: "NEUTRAL",
      mentions: 0,
    };
  }

  const score = parseFloat(row.score);
  const clamped = Math.max(-1, Math.min(1, score));

  return {
    symbol: symbol.toUpperCase(),
    sentimentScore: Math.round(clamped * 100) / 100,
    sentiment: getSentimentLabel(clamped),
    mentions: row.mentions || 0,
  };
}
