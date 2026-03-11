/**
 * Batch Stock Prices controller
 */

import * as batchPricesService from "../services/batchPricesService.js";
import logger from "../utils/logger.js";

export async function getBatchPrices(req, res, next) {
  try {
    const symbols = req.query.symbols;

    if (!symbols) {
      return res.status(400).json({
        error: true,
        message: "Query param 'symbols' required. Example: symbols=AAPL,TSLA,NVDA",
      });
    }

    const data = await batchPricesService.getBatchPrices(symbols);
    res.json(data);
  } catch (err) {
    if (err.message?.includes("Maximum")) {
      return res.status(400).json({ error: true, message: err.message });
    }
    logger.error("Batch prices error:", err);
    next(err);
  }
}
