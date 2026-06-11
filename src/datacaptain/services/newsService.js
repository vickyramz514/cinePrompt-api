/**
 * Stock news service
 */

import { StockNews } from "../models/index.js";

function mapRow(r) {
  return {
    id: r.id,
    symbol: r.symbol,
    headline: r.headline,
    summary: r.summary || null,
    source: r.source || null,
    url: r.url || null,
    publishedAt: r.published_at,
  };
}

export async function getNews(symbol, limit = 20) {
  const rows = await StockNews.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["published_at", "DESC"]],
    limit: Math.min(limit, 50),
    raw: true,
  });
  return rows.map(mapRow);
}
