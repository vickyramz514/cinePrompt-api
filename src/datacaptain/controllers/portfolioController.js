/**
 * Portfolio rebalancer controller
 */

import * as rebalanceService from "../services/rebalanceService.js";

export async function rebalance(req, res, next) {
  try {
    const body = req.method === "GET" ? req.query : req.body;

    let holdings = body.holdings;
    let target = body.target;

    if (typeof holdings === "string") {
      holdings = JSON.parse(holdings);
    }
    if (typeof target === "string") {
      target = JSON.parse(target);
    }

    const data = await rebalanceService.rebalancePortfolio({
      holdings,
      target,
      driftThreshold: body.driftThreshold,
      mode: body.mode,
    });
    res.json(data);
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(400).json({
        error: true,
        message: "Invalid JSON for holdings or target",
      });
    }
    next(err);
  }
}
