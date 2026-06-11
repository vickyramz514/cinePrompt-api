/**
 * Market movers controllers
 */

import * as marketService from "../services/marketService.js";
import * as earningsCalendarService from "../services/earningsCalendarService.js";

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

export async function getEarningsCalendar(req, res, next) {
  try {
    const { from, to, symbol } = req.query;
    const limit = parseInt(req.query.limit, 10) || 100;
    const data = await earningsCalendarService.getEarningsCalendar({
      from,
      to,
      symbol,
      limit,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}
