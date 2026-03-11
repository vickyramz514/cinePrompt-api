/**
 * Insider Trading controller
 */

import * as insiderService from "../services/insiderService.js";

export async function getInsiderTrades(req, res, next) {
  try {
    const { symbol } = req.params;
    const { limit } = req.query;

    const data = await insiderService.getInsiderTrades(symbol, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
