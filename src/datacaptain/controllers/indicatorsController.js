/**
 * Technical Indicators controller
 */

import * as indicatorsService from "../services/indicatorsService.js";

export async function getIndicators(req, res, next) {
  try {
    const { symbol } = req.params;
    const options = {};
    if (req.query.rsiPeriod) options.rsiPeriod = parseInt(req.query.rsiPeriod, 10);
    if (req.query.smaPeriod) options.smaPeriod = parseInt(req.query.smaPeriod, 10);
    if (req.query.emaPeriod) options.emaPeriod = parseInt(req.query.emaPeriod, 10);
    if (req.query.macdFast) options.macdFast = parseInt(req.query.macdFast, 10);
    if (req.query.macdSlow) options.macdSlow = parseInt(req.query.macdSlow, 10);
    if (req.query.macdSignal) options.macdSignal = parseInt(req.query.macdSignal, 10);
    if (req.query.bbPeriod) options.bbPeriod = parseInt(req.query.bbPeriod, 10);
    const data = await indicatorsService.getIndicators(symbol, options);
    if (!data) {
      return res.status(404).json({
        error: true,
        message: "Symbol not found or insufficient data for indicators.",
      });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
}
