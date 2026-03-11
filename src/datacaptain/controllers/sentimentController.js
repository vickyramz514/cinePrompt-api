/**
 * Stock Sentiment controller
 */

import * as sentimentService from "../services/sentimentService.js";

export async function getSentiment(req, res, next) {
  try {
    const { symbol } = req.params;

    const data = await sentimentService.getSentiment(symbol);
    res.json(data);
  } catch (err) {
    next(err);
  }
}
