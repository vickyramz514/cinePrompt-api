/**
 * Market Status controller
 */

import * as marketStatusService from "../services/marketStatusService.js";

export async function getStatus(req, res, next) {
  try {
    const data = marketStatusService.getMarketStatus();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
