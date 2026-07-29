/**
 * ETF controller
 */

import * as etfService from "../services/etfService.js";
import * as etfMetricsService from "../services/etfMetricsService.js";
import { normalizePlanSlug } from "../config/planAccess.js";

export async function getEtfList(req, res, next) {
  try {
    const { limit, offset, search, q, hasPrice } = req.query;
    const data = await etfService.getEtfList({
      limit,
      offset,
      search: search || q,
      hasPrice,
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
    const q = req.query;
    const data = await etfMetricsService.screenEtfs(
      {
        returnMin: q.returnMin,
        returnMax: q.returnMax,
        dividendYieldMin: q.dividendYieldMin,
        dividendYieldMax: q.dividendYieldMax,
        volatilityMin: q.volatilityMin,
        volatilityMax: q.volatilityMax,
        volumeMin: q.volumeMin,
        volumeMax: q.volumeMax,
        priceMin: q.priceMin,
        priceMax: q.priceMax,
        expenseMin: q.expenseMin,
        expenseMax: q.expenseMax,
        aumMin: q.aumMin,
        aumMax: q.aumMax,
        sharpeMin: q.sharpeMin,
        period: q.period,
        assetClass: q.assetClass,
        category: q.category,
        issuer: q.issuer,
        search: q.search || q.q,
        leveraged: q.leveraged,
        inverse: q.inverse,
        esg: q.esg,
        sort: q.sort,
        sortDir: q.sortDir,
        limit: q.limit,
        offset: q.offset,
        includeSparkline: q.includeSparkline,
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
    const q = req.query;
    const data = await etfMetricsService.rankEtfs(
      {
        category: q.category,
        metric: q.metric || q.category,
        period: q.period,
        assetClass: q.assetClass,
        basket: q.basket,
        search: q.search || q.q,
        sort: q.sort,
        sortDir: q.sortDir,
        limit: q.limit,
        offset: q.offset,
        includeSparkline: q.includeSparkline,
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
