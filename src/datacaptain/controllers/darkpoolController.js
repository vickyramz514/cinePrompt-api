/**
 * Dark Pool Trades controller
 */

import * as darkpoolService from "../services/darkpoolService.js";

export async function getDarkPoolTrades(req, res, next) {
  try {
    const { symbol } = req.params;
    const { limit } = req.query;

    const data = await darkpoolService.getDarkPoolTrades(symbol, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
