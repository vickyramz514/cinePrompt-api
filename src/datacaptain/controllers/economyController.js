/**
 * Economic Indicators controller
 */

import * as economyService from "../services/economyService.js";

export async function getIndicators(req, res, next) {
  try {
    const data = await economyService.getIndicators();
    res.json(data);
  } catch (err) {
    next(err);
  }
}
