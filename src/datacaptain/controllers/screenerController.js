/**
 * Stock Screener controller
 */

import * as screenerService from "../services/screenerService.js";

export async function screen(req, res, next) {
  try {
    const filters = {
      sector: req.query.sector,
      marketCapMin: req.query.marketCapMin,
      marketCapMax: req.query.marketCapMax,
      priceMin: req.query.priceMin,
      priceMax: req.query.priceMax,
      volumeMin: req.query.volumeMin,
      limit: req.query.limit,
    };
    const data = await screenerService.screenStocks(filters);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
