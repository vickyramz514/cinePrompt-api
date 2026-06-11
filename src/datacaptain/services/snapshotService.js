/**
 * Unified stock snapshot — one call for demos and client apps
 */

import * as stockService from "./stockService.js";
import * as dividendService from "./dividendService.js";
import * as sentimentService from "./sentimentService.js";
import * as indicatorsService from "./indicatorsService.js";
import * as aiStockScoreService from "./aiStockScoreService.js";
import * as newsService from "./newsService.js";
import { getNextEarning } from "./earningsCalendarService.js";

export async function getSnapshot(symbol) {
  const sym = symbol.toUpperCase();

  const [price, profile, sentiment, indicators, recentEarnings, news, aiScore, nextEarnings] =
    await Promise.all([
      stockService.getLatestPrice(sym),
      stockService.getProfile(sym),
      sentimentService.getSentiment(sym),
      indicatorsService.getIndicators(sym),
      dividendService.getEarnings(sym, 3),
      newsService.getNews(sym, 5),
      aiStockScoreService.getStockScore(sym),
      getNextEarning(sym),
    ]);

  if (!price) return null;

  return {
    symbol: sym,
    asOf: new Date().toISOString(),
    quote: price,
    profile,
    sentiment,
    indicators: indicators
      ? {
          date: indicators.date,
          rsi: indicators.rsi,
          sma20: indicators.sma,
          ema20: indicators.ema,
        }
      : null,
    aiScore: aiScore
      ? { score: aiScore.score, summary: aiScore.summary }
      : null,
    nextEarnings,
    recentEarnings,
    news,
  };
}
