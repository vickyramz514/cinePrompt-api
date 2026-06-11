/**
 * Stock news API
 */

import * as newsService from "../services/newsService.js";

export async function getNews(req, res, next) {
  try {
    const { symbol } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
    const data = await newsService.getNews(symbol, limit);
    res.json({
      symbol: symbol.toUpperCase(),
      count: data.length,
      articles: data,
    });
  } catch (err) {
    next(err);
  }
}
