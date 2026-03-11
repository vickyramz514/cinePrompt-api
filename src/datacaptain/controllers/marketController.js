/**
 * Market movers controllers
 */

import * as marketService from "../services/marketService.js";

export async function getTopGainers(req, res, next) {
  try {
    const limit = req.query.limit || 10;
    const data = await marketService.getTopGainers(limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getTopLosers(req, res, next) {
  try {
    const limit = req.query.limit || 10;
    const data = await marketService.getTopLosers(limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getMostActive(req, res, next) {
  try {
    const limit = req.query.limit || 10;
    const data = await marketService.getMostActive(limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
