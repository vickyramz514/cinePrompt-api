/**
 * AI Stock Score controller
 */

import * as aiStockScoreService from "../services/aiStockScoreService.js";

export async function getStockScore(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await aiStockScoreService.getStockScore(symbol);
    if (!data) {
      return res.status(404).json({
        error: true,
        message: "Symbol not found or insufficient data for score.",
      });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
}
