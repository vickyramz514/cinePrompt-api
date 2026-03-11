/**
 * Options Chain controller
 */

import * as optionsService from "../services/optionsService.js";

export async function getOptionsChain(req, res, next) {
  try {
    const { symbol } = req.params;
    const { expirationDate, limit } = req.query;

    const data = await optionsService.getOptionsChain(symbol, {
      expirationDate,
      limit,
    });

    res.json(data);
  } catch (err) {
    next(err);
  }
}
