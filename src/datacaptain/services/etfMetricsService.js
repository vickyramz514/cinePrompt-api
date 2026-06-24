/**
 * ETF metrics computation, heatmap, and screener
 */

import { Op, QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { Stock, HistoricalPrice, Dividend, EtfMetrics } from "../models/index.js";
import {
  HEATMAP_BASKETS,
  VALID_PERIODS,
  resolvePeriodField,
} from "../constants/etfBaskets.js";
import { isFreePlan } from "../config/planAccess.js";

const MAX_SCREENER_LIMIT = 100;
const FREE_SCREENER_LIMIT = 10;
const MAX_HEATMAP_SYMBOLS = 40;

function roundPct(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

function toDateStr(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function priceOnOrBefore(pricesAsc, targetDate) {
  let result = null;
  for (const row of pricesAsc) {
    if (row.date <= targetDate) result = row;
    else break;
  }
  return result;
}

function computeReturnPct(startClose, endClose) {
  if (!startClose || !endClose || startClose <= 0) return null;
  return roundPct(((endClose - startClose) / startClose) * 100);
}

function computeVolatility1y(pricesAsc, latestDate) {
  const oneYearAgo = addDays(latestDate, -365);
  const window = pricesAsc.filter((p) => p.date >= oneYearAgo);
  if (window.length < 20) return null;

  const logReturns = [];
  for (let i = 1; i < window.length; i++) {
    const prev = window[i - 1].close;
    const curr = window[i].close;
    if (prev > 0 && curr > 0) logReturns.push(Math.log(curr / prev));
  }
  if (logReturns.length < 10) return null;

  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
  return roundPct(Math.sqrt(variance) * Math.sqrt(252) * 100);
}

async function fetchDividendYieldTtm(symbol, latestPrice, latestDate) {
  if (!latestPrice || latestPrice <= 0) return null;

  const yearAgo = addDays(latestDate, -365);
  const dividends = await Dividend.findAll({
    where: {
      symbol: symbol.toUpperCase(),
      ex_date: { [Op.between]: [yearAgo, latestDate] },
    },
    attributes: ["amount"],
    raw: true,
  });

  if (!dividends.length) return null;

  const total = dividends.reduce((sum, d) => sum + parseFloat(d.amount), 0);
  return roundPct((total / latestPrice) * 100);
}

/**
 * Compute metrics for one ETF from its price history.
 */
export async function computeSymbolMetrics(symbol) {
  const sym = symbol?.toUpperCase();
  if (!sym) return null;

  const stock = await Stock.findOne({
    where: { symbol: sym, type: "ETF" },
    attributes: ["symbol", "name"],
    raw: true,
  });
  if (!stock) return null;

  const rows = await HistoricalPrice.findAll({
    where: { symbol: sym },
    order: [["date", "ASC"]],
    attributes: ["date", "close", "volume"],
    raw: true,
    limit: 8000,
  });

  if (rows.length < 2) return null;

  const pricesAsc = rows.map((r) => ({
    date: toDateStr(r.date),
    close: parseFloat(r.close),
    volume: r.volume ? Number(r.volume) : 0,
  }));

  const latest = pricesAsc[pricesAsc.length - 1];
  const latestDate = latest.date;
  const yearStart = `${latestDate.slice(0, 4)}-01-01`;

  const ytdStart = priceOnOrBefore(pricesAsc, yearStart);
  const p1y = priceOnOrBefore(pricesAsc, addDays(latestDate, -365));
  const p3y = priceOnOrBefore(pricesAsc, addDays(latestDate, -365 * 3));
  const p5y = priceOnOrBefore(pricesAsc, addDays(latestDate, -365 * 5));

  const recent30 = pricesAsc.slice(-30);
  const avgVolume30d =
    recent30.length > 0
      ? Math.round(recent30.reduce((s, p) => s + p.volume, 0) / recent30.length)
      : null;

  let assetClass = null;
  try {
    const [row] = await sequelize.query(
      `SELECT "assetClass" FROM "Instrument" WHERE symbol = :sym AND type = 'ETF' LIMIT 1`,
      { replacements: { sym }, type: QueryTypes.SELECT }
    );
    assetClass = row?.assetClass ?? null;
  } catch {
    // Instrument table may not exist
  }

  const dividendYield = await fetchDividendYieldTtm(sym, latest.close, latestDate);

  return {
    symbol: sym,
    name: stock.name,
    as_of_date: latestDate,
    latest_price: latest.close,
    latest_price_date: latestDate,
    return_ytd: computeReturnPct(ytdStart?.close, latest.close),
    return_1y: computeReturnPct(p1y?.close, latest.close),
    return_3y: computeReturnPct(p3y?.close, latest.close),
    return_5y: computeReturnPct(p5y?.close, latest.close),
    dividend_yield_ttm: dividendYield,
    volatility_1y: computeVolatility1y(pricesAsc, latestDate),
    avg_volume_30d: avgVolume30d,
    asset_class: assetClass,
  };
}

export async function upsertMetrics(metrics) {
  if (!metrics) return null;
  await EtfMetrics.upsert({
    symbol: metrics.symbol,
    as_of_date: metrics.as_of_date,
    latest_price: metrics.latest_price,
    latest_price_date: metrics.latest_price_date,
    return_ytd: metrics.return_ytd,
    return_1y: metrics.return_1y,
    return_3y: metrics.return_3y,
    return_5y: metrics.return_5y,
    dividend_yield_ttm: metrics.dividend_yield_ttm,
    volatility_1y: metrics.volatility_1y,
    avg_volume_30d: metrics.avg_volume_30d,
    asset_class: metrics.asset_class,
  });
  return metrics;
}

export async function computeAndStoreSymbol(symbol) {
  const metrics = await computeSymbolMetrics(symbol);
  if (metrics) await upsertMetrics(metrics);
  return metrics;
}

/**
 * Recompute metrics for all ETFs with price history.
 */
export async function computeAllMetrics({ onProgress } = {}) {
  const rows = await sequelize.query(
    `
    SELECT DISTINCT s.symbol
    FROM stocks s
    INNER JOIN historical_prices hp ON hp.symbol = s.symbol
    WHERE s.type = 'ETF' AND (s.is_active IS NULL OR s.is_active = true)
    ORDER BY s.symbol
    `,
    { type: QueryTypes.SELECT }
  );

  const symbols = rows.map((r) => r.symbol);
  let processed = 0;
  let stored = 0;

  const BATCH = 50;
  for (let i = 0; i < symbols.length; i += BATCH) {
    const batch = symbols.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((sym) => computeSymbolMetrics(sym)));
    for (const metrics of results) {
      if (metrics) {
        await upsertMetrics(metrics);
        stored += 1;
      }
    }
    processed += batch.length;
    if (onProgress) onProgress({ processed, total: symbols.length, stored });
  }

  return { total: symbols.length, stored };
}

function metricsRowToCell(row, periodField) {
  return {
    symbol: row.symbol,
    name: row.name ?? row.symbol,
    returnPct: row[periodField] != null ? parseFloat(row[periodField]) : null,
    latestPrice: row.latest_price != null ? parseFloat(row.latest_price) : null,
    dividendYieldTtm:
      row.dividend_yield_ttm != null ? parseFloat(row.dividend_yield_ttm) : null,
    assetClass: row.asset_class ?? null,
  };
}

async function loadMetricsRows(symbols) {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const rows = await sequelize.query(
    `
    SELECT m.*, s.name
    FROM etf_metrics m
    INNER JOIN stocks s ON s.symbol = m.symbol
    WHERE m.symbol IN (:symbols) AND s.type = 'ETF'
    `,
    { replacements: { symbols: unique }, type: QueryTypes.SELECT }
  );

  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  const missing = unique.filter((sym) => !bySymbol.has(sym));

  for (const sym of missing) {
    const computed = await computeAndStoreSymbol(sym);
    if (computed) bySymbol.set(sym, { ...computed, name: computed.name });
  }

  return unique.map((sym) => bySymbol.get(sym)).filter(Boolean);
}

export async function getHeatmap({ basket, symbols, period = "1y" }) {
  const periodKey = VALID_PERIODS.has(period) ? period : "1y";
  const periodField = resolvePeriodField(periodKey);

  let symbolList = [];
  let basketMeta = null;

  if (basket && HEATMAP_BASKETS[basket]) {
    basketMeta = { id: basket, ...HEATMAP_BASKETS[basket] };
    symbolList = basketMeta.symbols;
  } else if (symbols) {
    symbolList = symbols
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, MAX_HEATMAP_SYMBOLS);
  } else {
    basketMeta = { id: "broad", ...HEATMAP_BASKETS.broad };
    symbolList = basketMeta.symbols;
  }

  const rows = await loadMetricsRows(symbolList);
  const cells = symbolList
    .map((sym) => {
      const row = rows.find((r) => r.symbol === sym);
      if (!row) return null;
      return metricsRowToCell(row, periodField);
    })
    .filter(Boolean);

  const asOf = rows[0]?.as_of_date ?? new Date().toISOString().slice(0, 10);

  return {
    period: periodKey,
    asOf: toDateStr(asOf),
    basket: basketMeta,
    cells,
  };
}

export async function screenEtfs(filters, plan) {
  const {
    returnMin,
    dividendYieldMin,
    period = "1y",
    assetClass,
    sort = "return",
    limit = 50,
    offset = 0,
  } = filters;

  const periodKey = VALID_PERIODS.has(period) ? period : "1y";
  const periodField = resolvePeriodField(periodKey);

  const isFree = isFreePlan(plan);
  const maxLimit = isFree ? FREE_SCREENER_LIMIT : MAX_SCREENER_LIMIT;
  const limitVal = Math.min(Math.max(parseInt(limit, 10) || 50, 1), maxLimit);
  const offsetVal = isFree ? 0 : Math.max(parseInt(offset, 10) || 0, 0);

  const whereParts = [`s.type = 'ETF'`, `(s.is_active IS NULL OR s.is_active = true)`];
  const replacements = { limit: limitVal, offset: offsetVal };

  if (returnMin != null && returnMin !== "") {
    whereParts.push(`m.${periodField} >= :returnMin`);
    replacements.returnMin = parseFloat(returnMin);
  }
  if (dividendYieldMin != null && dividendYieldMin !== "") {
    whereParts.push(`m.dividend_yield_ttm >= :dividendYieldMin`);
    replacements.dividendYieldMin = parseFloat(dividendYieldMin);
  }
  if (assetClass) {
    whereParts.push(`m.asset_class ILIKE :assetClass`);
    replacements.assetClass = `%${assetClass}%`;
  }

  const sortColumn =
    sort === "yield"
      ? "m.dividend_yield_ttm"
      : sort === "volatility"
        ? "m.volatility_1y"
        : `m.${periodField}`;

  const whereClause = whereParts.join(" AND ");

  const [countRow] = await sequelize.query(
    `
    SELECT COUNT(*)::int AS total
    FROM etf_metrics m
    INNER JOIN stocks s ON s.symbol = m.symbol
    WHERE ${whereClause}
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  const rows = await sequelize.query(
    `
    SELECT m.symbol, s.name, m.latest_price, m.as_of_date,
      m.return_ytd, m.return_1y, m.return_3y, m.return_5y,
      m.dividend_yield_ttm, m.volatility_1y, m.avg_volume_30d, m.asset_class
    FROM etf_metrics m
    INNER JOIN stocks s ON s.symbol = m.symbol
    WHERE ${whereClause}
    ORDER BY ${sortColumn} DESC NULLS LAST, m.symbol ASC
    LIMIT :limit OFFSET :offset
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  return {
    period: periodKey,
    data: rows.map((r) => ({
      symbol: r.symbol,
      name: r.name,
      latestPrice: r.latest_price != null ? parseFloat(r.latest_price) : null,
      asOf: toDateStr(r.as_of_date),
      returnYtd: r.return_ytd != null ? parseFloat(r.return_ytd) : null,
      return1y: r.return_1y != null ? parseFloat(r.return_1y) : null,
      return3y: r.return_3y != null ? parseFloat(r.return_3y) : null,
      return5y: r.return_5y != null ? parseFloat(r.return_5y) : null,
      dividendYieldTtm:
        r.dividend_yield_ttm != null ? parseFloat(r.dividend_yield_ttm) : null,
      volatility1y: r.volatility_1y != null ? parseFloat(r.volatility_1y) : null,
      avgVolume30d: r.avg_volume_30d ? Number(r.avg_volume_30d) : null,
      assetClass: r.asset_class ?? null,
    })),
    total: countRow?.total ?? 0,
    limit: limitVal,
    offset: offsetVal,
    freeTierLimited: isFree,
  };
}

export function listHeatmapBaskets() {
  return Object.entries(HEATMAP_BASKETS).map(([id, basket]) => ({
    id,
    label: basket.label,
    symbols: basket.symbols,
  }));
}
