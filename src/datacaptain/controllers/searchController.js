/**
 * Search controller
 */

import * as stockService from "../services/stockService.js";

export async function search(req, res, next) {
  try {
    const q = req.query.q;
    if (!q || q.length < 2) {
      return res.status(400).json({
        error: true,
        message: "Search query 'q' must be at least 2 characters",
      });
    }
    const data = await stockService.searchStocks(q);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
