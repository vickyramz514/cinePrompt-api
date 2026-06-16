/**
 * ETF controller
 */

import * as etfService from "../services/etfService.js";

export async function getEtfList(req, res, next) {
  try {
    const { limit, offset, search, q } = req.query;
    const data = await etfService.getEtfList({
      limit,
      offset,
      search: search || q,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getEtfBySymbol(req, res, next) {
  try {
    const { symbol } = req.params;
    const data = await etfService.getEtfBySymbol(symbol);

    if (!data) {
      return res.status(404).json({
        error: true,
        message: "ETF not found",
      });
    }

    res.json(data);
  } catch (err) {
    next(err);
  }
}
