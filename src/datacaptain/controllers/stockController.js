/**
 * Stock API controllers
 */

import * as stockService from "../services/stockService.js";
import * as dividendService from "../services/dividendService.js";

export async function getPrice(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await stockService.getLatestPrice(symbol);
    if (!data) {
      return res.status(404).json({
        error: true,
        message: "Symbol not found. Use GET /api/search?q= to find available symbols.",
      });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getHistory(req, res, next) {
  try {
    const { symbol } = req.params;
    const { startDate, endDate, interval = "1d" } = req.query;
    const data = await stockService.getHistory(symbol, startDate, endDate, interval);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getCandles(req, res, next) {
  try {
    const { symbol } = req.params;
    const { interval = "1d", limit = 100 } = req.query;
    const data = await stockService.getCandles(symbol, interval, limit);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getProfile(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await stockService.getProfile(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getDividends(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await dividendService.getDividends(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getEarnings(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await dividendService.getEarnings(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
