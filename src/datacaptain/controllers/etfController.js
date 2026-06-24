/**
 * ETF controller
 */

import * as etfService from "../services/etfService.js";
import * as etfMetricsService from "../services/etfMetricsService.js";
import { normalizePlanSlug } from "../config/planAccess.js";

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

export async function getEtfHeatmap(req, res, next) {
  try {
    const { basket, symbols, period } = req.query;
    const data = await etfMetricsService.getHeatmap({ basket, symbols, period });
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getEtfHeatmapBaskets(req, res, next) {
  try {
    res.json({ baskets: etfMetricsService.listHeatmapBaskets() });
  } catch (err) {
    next(err);
  }
}

export async function getEtfScreener(req, res, next) {
  try {
    const plan = normalizePlanSlug(req.apiUser?.plan);
    const data = await etfMetricsService.screenEtfs(
      {
        returnMin: req.query.returnMin,
        dividendYieldMin: req.query.dividendYieldMin,
        period: req.query.period,
        assetClass: req.query.assetClass,
        sort: req.query.sort,
        limit: req.query.limit,
        offset: req.query.offset,
      },
      plan
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}

export async function getEtfRankings(req, res, next) {
  try {
    const plan = normalizePlanSlug(req.apiUser?.plan);
    const data = await etfMetricsService.rankEtfs(
      {
        category: req.query.category,
        period: req.query.period,
        assetClass: req.query.assetClass,
        limit: req.query.limit,
        offset: req.query.offset,
      },
      plan
    );
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
