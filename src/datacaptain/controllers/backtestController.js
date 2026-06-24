/**
 * Backtesting & portfolio comparison controllers
 */

import * as backtestService from "../services/backtestService.js";

export async function runBuyAndHold(req, res, next) {
  try {
    const body = req.method === "GET" ? req.query : req.body;
    const data = await backtestService.runBuyAndHoldBacktest({
      symbol: body.symbol,
      investment: body.investment,
      startDate: body.startDate,
      endDate: body.endDate,
      strategy: body.strategy || "buy_and_hold",
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function compareSymbols(req, res, next) {
  try {
    const body = req.method === "GET" ? req.query : req.body;
    const symbols =
      typeof body.symbols === "string"
        ? body.symbols.split(",").map((s) => s.trim())
        : body.symbols;

    const data = await backtestService.compareBuyAndHold({
      symbols,
      investment: body.investment,
      startDate: body.startDate,
      endDate: body.endDate,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}
