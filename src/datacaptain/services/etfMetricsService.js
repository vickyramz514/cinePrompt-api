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
  periodLookbackDays,
  ETF_STATIC_META,
  inferIssuer,
  classifyEtf,
  symbolsForCategory,
} from "../constants/etfBaskets.js";
import { isFreePlan } from "../config/planAccess.js";

const MAX_SCREENER_LIMIT = 100;
const FREE_SCREENER_LIMIT = 10;
const MAX_HEATMAP_SYMBOLS = 80;
const SCREENER_POOL_CAP = 800;

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
    returnPct: periodField && row[periodField] != null ? parseFloat(row[periodField]) : null,
    latestPrice: row.latest_price != null ? parseFloat(row.latest_price) : null,
    dividendYieldTtm:
      row.dividend_yield_ttm != null ? parseFloat(row.dividend_yield_ttm) : null,
    assetClass: row.asset_class ?? null,
    returnYtd: row.return_ytd != null ? parseFloat(row.return_ytd) : null,
    return1y: row.return_1y != null ? parseFloat(row.return_1y) : null,
    return3y: row.return_3y != null ? parseFloat(row.return_3y) : null,
    return5y: row.return_5y != null ? parseFloat(row.return_5y) : null,
    volatility1y: row.volatility_1y != null ? parseFloat(row.volatility_1y) : null,
    avgVolume30d: row.avg_volume_30d != null ? Number(row.avg_volume_30d) : null,
  };
}

async function loadMetricsRows(symbols) {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];
  if (!unique.length) return [];
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

async function loadRecentPricesForSymbols(symbols, lookbackDays = 400) {
  if (!symbols.length) return new Map();
  const since = addDays(new Date().toISOString().slice(0, 10), -(lookbackDays + 30));
  const rows = await HistoricalPrice.findAll({
    where: {
      symbol: { [Op.in]: symbols.map((s) => s.toUpperCase()) },
      date: { [Op.gte]: since },
    },
    order: [
      ["symbol", "ASC"],
      ["date", "ASC"],
    ],
    attributes: ["symbol", "date", "close", "volume"],
    raw: true,
    limit: symbols.length * 800,
  });

  const map = new Map();
  for (const r of rows) {
    const sym = r.symbol;
    if (!map.has(sym)) map.set(sym, []);
    map.get(sym).push({
      date: toDateStr(r.date),
      close: parseFloat(r.close),
      volume: r.volume ? Number(r.volume) : 0,
    });
  }
  return map;
}

function enrichCellFromPrices(cell, pricesAsc, periodKey) {
  if (!pricesAsc?.length) {
    return {
      ...cell,
      return1d: null,
      return1w: null,
      return1m: null,
      return3m: null,
      return6m: null,
      return10y: null,
      returnMax: null,
      sparkline: [],
      aumBillions: ETF_STATIC_META[cell.symbol]?.aumBillions ?? null,
      expenseRatio: ETF_STATIC_META[cell.symbol]?.expenseRatio ?? null,
      sizeScore: cell.avgVolume30d || 1,
    };
  }

  const latest = pricesAsc[pricesAsc.length - 1];
  const latestDate = latest.date;
  const computeAt = (days) => {
    const start = priceOnOrBefore(pricesAsc, addDays(latestDate, -days));
    return computeReturnPct(start?.close, latest.close);
  };

  const return1d =
    pricesAsc.length >= 2
      ? computeReturnPct(pricesAsc[pricesAsc.length - 2].close, latest.close)
      : null;
  const return1w = computeAt(7);
  const return1m = computeAt(30);
  const return3m = computeAt(91);
  const return6m = computeAt(182);
  const return10y = computeAt(365 * 10);
  const returnMax = computeReturnPct(pricesAsc[0].close, latest.close);

  const periodField = resolvePeriodField(periodKey);
  let returnPct = cell.returnPct;
  if (!periodField) {
    if (periodKey === "1d") returnPct = return1d;
    else if (periodKey === "1w") returnPct = return1w;
    else if (periodKey === "1m") returnPct = return1m;
    else if (periodKey === "3m") returnPct = return3m;
    else if (periodKey === "6m") returnPct = return6m;
    else if (periodKey === "10y") returnPct = return10y;
    else if (periodKey === "max") returnPct = returnMax;
    else if (periodKey === "ytd") returnPct = cell.returnYtd;
  }

  const sparkSrc = pricesAsc.slice(-30);
  const sparkline = sparkSrc.map((p) => roundPct(p.close) ?? p.close);

  const meta = ETF_STATIC_META[cell.symbol] || {};
  const aumBillions = meta.aumBillions ?? null;
  const expenseRatio = meta.expenseRatio ?? null;
  const sizeScore = aumBillions != null ? aumBillions * 1e9 : cell.avgVolume30d || 1;

  return {
    ...cell,
    returnPct,
    return1d,
    return1w,
    return1m,
    return3m,
    return6m,
    return10y,
    returnMax,
    sparkline,
    aumBillions,
    expenseRatio,
    sizeScore,
  };
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

  symbolList = [...new Set(symbolList)].slice(0, MAX_HEATMAP_SYMBOLS);

  const rows = await loadMetricsRows(symbolList);
  const lookback = Math.max(periodLookbackDays(periodKey) || 400, 400);
  const priceMap = await loadRecentPricesForSymbols(symbolList, lookback);

  const cells = symbolList
    .map((sym) => {
      const row = rows.find((r) => r.symbol === sym);
      if (!row) return null;
      const base = metricsRowToCell(row, periodField || "return_1y");
      if (!periodField) base.returnPct = null;
      return enrichCellFromPrices(base, priceMap.get(sym) || [], periodKey);
    })
    .filter(Boolean);

  const asOf = rows[0]?.as_of_date ?? new Date().toISOString().slice(0, 10);

  return {
    period: periodKey,
    asOf: toDateStr(asOf),
    basket: basketMeta
      ? { id: basketMeta.id, label: basketMeta.label, symbols: basketMeta.symbols }
      : null,
    cells,
  };
}

export async function screenEtfs(filters, plan) {
  const {
    returnMin,
    returnMax,
    dividendYieldMin,
    dividendYieldMax,
    volatilityMin,
    volatilityMax,
    volumeMin,
    volumeMax,
    priceMin,
    priceMax,
    expenseMin,
    expenseMax,
    aumMin,
    aumMax,
    sharpeMin,
    period = "1y",
    assetClass,
    category,
    issuer,
    search,
    leveraged,
    inverse,
    esg,
    sort = "return",
    sortDir = "desc",
    limit = 50,
    offset = 0,
    includeSparkline = "1",
  } = filters;

  const cachedPeriods = new Set(["ytd", "1y", "3y", "5y"]);
  const periodKey = cachedPeriods.has(period) ? period : "1y";
  const periodField = resolvePeriodField(periodKey) || "return_1y";

  const isFree = isFreePlan(plan);
  const maxLimit = isFree ? FREE_SCREENER_LIMIT : MAX_SCREENER_LIMIT;
  const limitVal = Math.min(Math.max(parseInt(limit, 10) || 50, 1), maxLimit);
  const offsetVal = isFree ? 0 : Math.max(parseInt(offset, 10) || 0, 0);

  const whereParts = [`s.type = 'ETF'`, `(s.is_active IS NULL OR s.is_active = true)`];
  const replacements = {};

  if (returnMin != null && returnMin !== "") {
    whereParts.push(`m.${periodField} >= :returnMin`);
    replacements.returnMin = parseFloat(returnMin);
  }
  if (returnMax != null && returnMax !== "") {
    whereParts.push(`m.${periodField} <= :returnMax`);
    replacements.returnMax = parseFloat(returnMax);
  }
  if (dividendYieldMin != null && dividendYieldMin !== "") {
    whereParts.push(`m.dividend_yield_ttm >= :dividendYieldMin`);
    replacements.dividendYieldMin = parseFloat(dividendYieldMin);
  }
  if (dividendYieldMax != null && dividendYieldMax !== "") {
    whereParts.push(`m.dividend_yield_ttm <= :dividendYieldMax`);
    replacements.dividendYieldMax = parseFloat(dividendYieldMax);
  }
  if (volatilityMin != null && volatilityMin !== "") {
    whereParts.push(`m.volatility_1y >= :volatilityMin`);
    replacements.volatilityMin = parseFloat(volatilityMin);
  }
  if (volatilityMax != null && volatilityMax !== "") {
    whereParts.push(`m.volatility_1y <= :volatilityMax`);
    replacements.volatilityMax = parseFloat(volatilityMax);
  }
  if (volumeMin != null && volumeMin !== "") {
    whereParts.push(`m.avg_volume_30d >= :volumeMin`);
    replacements.volumeMin = parseFloat(volumeMin);
  }
  if (volumeMax != null && volumeMax !== "") {
    whereParts.push(`m.avg_volume_30d <= :volumeMax`);
    replacements.volumeMax = parseFloat(volumeMax);
  }
  if (priceMin != null && priceMin !== "") {
    whereParts.push(`m.latest_price >= :priceMin`);
    replacements.priceMin = parseFloat(priceMin);
  }
  if (priceMax != null && priceMax !== "") {
    whereParts.push(`m.latest_price <= :priceMax`);
    replacements.priceMax = parseFloat(priceMax);
  }
  if (assetClass) {
    whereParts.push(`m.asset_class ILIKE :assetClass`);
    replacements.assetClass = `%${assetClass}%`;
  }
  if (search) {
    whereParts.push(`(s.symbol ILIKE :search OR s.name ILIKE :search)`);
    replacements.search = `%${String(search).trim()}%`;
  }

  const categorySymbols = symbolsForCategory(category);
  if (categorySymbols?.length) {
    whereParts.push(`m.symbol IN (:categorySymbols)`);
    replacements.categorySymbols = categorySymbols;
  }
  if (leveraged === "1" || leveraged === "true") {
    whereParts.push(`m.symbol IN (:leveragedSymbols)`);
    replacements.leveragedSymbols = HEATMAP_BASKETS.leveraged.symbols;
  }
  if (inverse === "1" || inverse === "true") {
    whereParts.push(`m.symbol IN (:inverseSymbols)`);
    replacements.inverseSymbols = HEATMAP_BASKETS.inverse.symbols;
  }
  if (esg === "1" || esg === "true") {
    whereParts.push(`m.symbol IN (:esgSymbols)`);
    replacements.esgSymbols = HEATMAP_BASKETS.esg.symbols;
  }

  const sqlSortMap = {
    return: `m.${periodField}`,
    yield: "m.dividend_yield_ttm",
    volatility: "m.volatility_1y",
    volume: "m.avg_volume_30d",
    price: "m.latest_price",
    symbol: "m.symbol",
    name: "s.name",
  };
  const needsMetaSort = ["expense", "aum", "sharpe", "issuer", "category"].includes(sort);
  const sortColumn = sqlSortMap[sort] || `m.${periodField}`;
  const dir = String(sortDir).toLowerCase() === "asc" ? "ASC" : "DESC";
  const whereClause = whereParts.join(" AND ");

  // Pull a pool then enrich/filter/paginate in memory for meta fields
  const poolRows = await sequelize.query(
    `
    SELECT m.symbol, s.name, m.latest_price, m.as_of_date,
      m.return_ytd, m.return_1y, m.return_3y, m.return_5y,
      m.dividend_yield_ttm, m.volatility_1y, m.avg_volume_30d, m.asset_class
    FROM etf_metrics m
    INNER JOIN stocks s ON s.symbol = m.symbol
    WHERE ${whereClause}
    ORDER BY ${sortColumn} ${dir} NULLS LAST, m.symbol ASC
    LIMIT ${SCREENER_POOL_CAP}
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  let enriched = poolRows.map((r) => {
    const symbol = r.symbol;
    const name = r.name;
    const meta = ETF_STATIC_META[symbol] || {};
    const cls = classifyEtf(symbol);
    const return1y = r.return_1y != null ? parseFloat(r.return_1y) : null;
    const return3y = r.return_3y != null ? parseFloat(r.return_3y) : null;
    const return5y = r.return_5y != null ? parseFloat(r.return_5y) : null;
    const volatility1y = r.volatility_1y != null ? parseFloat(r.volatility_1y) : null;
    const sharpeRatio =
      return1y != null && volatility1y != null && volatility1y > 0
        ? roundPct(return1y / volatility1y)
        : null;
    // Approximate CAGR from multi-year cumulative returns
    const cagr3y =
      return3y != null ? roundPct((Math.pow(1 + return3y / 100, 1 / 3) - 1) * 100) : null;
    const periodReturn =
      periodKey === "ytd"
        ? r.return_ytd != null
          ? parseFloat(r.return_ytd)
          : null
        : periodKey === "3y"
          ? return3y
          : periodKey === "5y"
            ? return5y
            : return1y;

    return {
      symbol,
      name,
      latestPrice: r.latest_price != null ? parseFloat(r.latest_price) : null,
      asOf: toDateStr(r.as_of_date),
      returnYtd: r.return_ytd != null ? parseFloat(r.return_ytd) : null,
      return1y,
      return3y,
      return5y,
      returnPct: periodReturn,
      cagr: cagr3y ?? return1y,
      dividendYieldTtm:
        r.dividend_yield_ttm != null ? parseFloat(r.dividend_yield_ttm) : null,
      volatility1y,
      avgVolume30d: r.avg_volume_30d ? Number(r.avg_volume_30d) : null,
      assetClass: r.asset_class ?? null,
      aumBillions: meta.aumBillions ?? null,
      expenseRatio: meta.expenseRatio ?? null,
      sharpeRatio,
      issuer: inferIssuer(symbol, name),
      category: cls.category,
      badges: cls.badges,
      leveraged: cls.leveraged,
      inverse: cls.inverse,
      esg: cls.esg,
      country: "US",
      currency: "USD",
      sparkline: [],
    };
  });

  const numOrNull = (v) => (v == null || v === "" ? null : parseFloat(v));
  const eMin = numOrNull(expenseMin);
  const eMax = numOrNull(expenseMax);
  const aMin = numOrNull(aumMin);
  const aMax = numOrNull(aumMax);
  const sMin = numOrNull(sharpeMin);

  if (eMin != null) enriched = enriched.filter((r) => r.expenseRatio != null && r.expenseRatio >= eMin);
  if (eMax != null) enriched = enriched.filter((r) => r.expenseRatio != null && r.expenseRatio <= eMax);
  if (aMin != null) enriched = enriched.filter((r) => r.aumBillions != null && r.aumBillions >= aMin);
  if (aMax != null) enriched = enriched.filter((r) => r.aumBillions != null && r.aumBillions <= aMax);
  if (sMin != null) enriched = enriched.filter((r) => r.sharpeRatio != null && r.sharpeRatio >= sMin);
  if (issuer) {
    const i = String(issuer).toLowerCase();
    enriched = enriched.filter((r) => r.issuer.toLowerCase().includes(i));
  }
  if (search) {
    const q = String(search).trim().toLowerCase();
    enriched = enriched.filter(
      (r) =>
        r.symbol.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.issuer.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.badges || []).some((b) => b.toLowerCase().includes(q))
    );
  }

  if (needsMetaSort) {
    const asc = dir === "ASC";
    enriched.sort((a, b) => {
      const pick = (row) => {
        if (sort === "expense") return row.expenseRatio;
        if (sort === "aum") return row.aumBillions;
        if (sort === "sharpe") return row.sharpeRatio;
        if (sort === "issuer") return row.issuer;
        if (sort === "category") return row.category;
        return row.returnPct;
      };
      const av = pick(a);
      const bv = pick(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return asc ? av.localeCompare(bv) : bv.localeCompare(av);
      return asc ? av - bv : bv - av;
    });
  }

  const total = enriched.length;
  const page = enriched.slice(offsetVal, offsetVal + limitVal);

  if (includeSparkline !== "0" && page.length) {
    try {
      const priceMap = await loadRecentPricesForSymbols(
        page.map((r) => r.symbol),
        60
      );
      for (const row of page) {
        const prices = priceMap.get(row.symbol) || [];
        row.sparkline = prices.slice(-30).map((p) => p.close);
        if (prices.length >= 2) {
          const last = prices[prices.length - 1].close;
          const prev = prices[prices.length - 2].close;
          row.return1d = computeReturnPct(prev, last);
          const mStart = priceOnOrBefore(prices, addDays(prices[prices.length - 1].date, -30));
          row.return1m = computeReturnPct(mStart?.close, last);
        }
      }
    } catch {
      /* sparklines optional */
    }
  }

  return {
    period: periodKey,
    data: page,
    total,
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

const RANKING_METRICS = new Set([
  "return",
  "yield",
  "volatility",
  "cagr",
  "sharpe",
  "expense",
  "aum",
  "drawdown",
]);

function approxMaxDrawdown(prices) {
  if (!prices?.length) return null;
  let peak = prices[0];
  let maxDd = 0;
  for (const p of prices) {
    if (p > peak) peak = p;
    if (peak > 0) {
      const dd = ((peak - p) / peak) * 100;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return roundPct(maxDd);
}

function metricValue(row, metric, periodKey) {
  switch (metric) {
    case "yield":
      return row.dividendYieldTtm;
    case "volatility":
      return row.volatility1y;
    case "cagr":
      return row.cagr;
    case "sharpe":
      return row.sharpeRatio;
    case "expense":
      return row.expenseRatio;
    case "aum":
      return row.aumBillions;
    case "drawdown":
      return row.maxDrawdown;
    case "return":
    default:
      if (periodKey === "ytd") return row.returnYtd;
      if (periodKey === "3y") return row.return3y;
      if (periodKey === "5y") return row.return5y;
      return row.return1y;
  }
}

function sortAscForMetric(metric) {
  return metric === "volatility" || metric === "expense" || metric === "drawdown";
}

/**
 * Leaderboard rankings — enriched ETF leaderboard with multiple metrics.
 */
export async function rankEtfs(filters, plan) {
  const {
    category,
    metric: metricRaw,
    period = "1y",
    assetClass,
    basket,
    search,
    sort,
    sortDir,
    limit = 20,
    offset = 0,
    includeSparkline = "1",
  } = filters;

  // Back-compat: older clients send category=return|yield|volatility as the metric
  const legacyMetric = ["return", "yield", "volatility"].includes(category) ? category : null;
  const metricKey = RANKING_METRICS.has(metricRaw)
    ? metricRaw
    : legacyMetric || (RANKING_METRICS.has(category) ? category : "return");

  const basketId = basket || (HEATMAP_BASKETS[category] ? category : null);

  const cachedPeriods = new Set(["ytd", "1y", "3y", "5y"]);
  const periodKey = cachedPeriods.has(period) ? period : "1y";
  const periodField = resolvePeriodField(periodKey) || "return_1y";
  const prevPeriodKey = periodKey === "ytd" ? "1y" : periodKey === "1y" ? "ytd" : periodKey === "3y" ? "1y" : "3y";

  const isFree = isFreePlan(plan);
  const maxLimit = isFree ? FREE_SCREENER_LIMIT : MAX_SCREENER_LIMIT;
  const limitVal = Math.min(Math.max(parseInt(limit, 10) || 20, 1), maxLimit);
  const offsetVal = isFree ? 0 : Math.max(parseInt(offset, 10) || 0, 0);

  const whereParts = [`s.type = 'ETF'`, `(s.is_active IS NULL OR s.is_active = true)`];
  const replacements = {};

  if (assetClass) {
    whereParts.push(`m.asset_class ILIKE :assetClass`);
    replacements.assetClass = `%${assetClass}%`;
  }

  const basketSymbols = symbolsForCategory(basketId);
  if (basketSymbols?.length) {
    whereParts.push(`m.symbol IN (:basketSymbols)`);
    replacements.basketSymbols = basketSymbols;
  }

  if (search) {
    whereParts.push(`(s.symbol ILIKE :search OR s.name ILIKE :search)`);
    replacements.search = `%${String(search).trim()}%`;
  }

  const whereClause = whereParts.join(" AND ");

  const poolRows = await sequelize.query(
    `
    SELECT m.symbol, s.name, m.latest_price, m.as_of_date,
      m.return_ytd, m.return_1y, m.return_3y, m.return_5y,
      m.dividend_yield_ttm, m.volatility_1y, m.avg_volume_30d, m.asset_class
    FROM etf_metrics m
    INNER JOIN stocks s ON s.symbol = m.symbol
    WHERE ${whereClause}
    ORDER BY m.${periodField} DESC NULLS LAST, m.symbol ASC
    LIMIT ${SCREENER_POOL_CAP}
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  let enriched = poolRows.map((r) => {
    const symbol = r.symbol;
    const name = r.name;
    const meta = ETF_STATIC_META[symbol] || {};
    const cls = classifyEtf(symbol);
    const return1y = r.return_1y != null ? parseFloat(r.return_1y) : null;
    const return3y = r.return_3y != null ? parseFloat(r.return_3y) : null;
    const return5y = r.return_5y != null ? parseFloat(r.return_5y) : null;
    const volatility1y = r.volatility_1y != null ? parseFloat(r.volatility_1y) : null;
    const sharpeRatio =
      return1y != null && volatility1y != null && volatility1y > 0
        ? roundPct(return1y / volatility1y)
        : null;
    const cagr =
      return3y != null ? roundPct((Math.pow(1 + return3y / 100, 1 / 3) - 1) * 100) : return1y;

    return {
      symbol,
      name,
      latestPrice: r.latest_price != null ? parseFloat(r.latest_price) : null,
      asOf: toDateStr(r.as_of_date),
      returnYtd: r.return_ytd != null ? parseFloat(r.return_ytd) : null,
      return1y,
      return3y,
      return5y,
      cagr,
      dividendYieldTtm:
        r.dividend_yield_ttm != null ? parseFloat(r.dividend_yield_ttm) : null,
      volatility1y,
      avgVolume30d: r.avg_volume_30d ? Number(r.avg_volume_30d) : null,
      assetClass: r.asset_class ?? null,
      aumBillions: meta.aumBillions ?? null,
      expenseRatio: meta.expenseRatio ?? null,
      sharpeRatio,
      maxDrawdown: null,
      issuer: inferIssuer(symbol, name),
      category: cls.category,
      badges: cls.badges,
      leveraged: cls.leveraged,
      inverse: cls.inverse,
      esg: cls.esg,
      country: "US",
      currency: "USD",
      sparkline: [],
    };
  });

  if (search) {
    const q = String(search).trim().toLowerCase();
    enriched = enriched.filter(
      (r) =>
        r.symbol.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        r.issuer.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
    );
  }

  // Sparklines + drawdown for ranking pool (capped for cost)
  const sparkPool = enriched.slice(0, Math.min(enriched.length, 200));
  if (includeSparkline !== "0" && sparkPool.length) {
    try {
      const priceMap = await loadRecentPricesForSymbols(
        sparkPool.map((r) => r.symbol),
        90
      );
      for (const row of sparkPool) {
        const prices = priceMap.get(row.symbol) || [];
        const closes = prices.slice(-30).map((p) => p.close);
        row.sparkline = closes;
        row.maxDrawdown = approxMaxDrawdown(closes.length ? closes : prices.map((p) => p.close));
        if (prices.length >= 2) {
          const last = prices[prices.length - 1].close;
          const prev = prices[prices.length - 2].close;
          row.return1d = computeReturnPct(prev, last);
          const mStart = priceOnOrBefore(prices, addDays(prices[prices.length - 1].date, -30));
          row.return1m = computeReturnPct(mStart?.close, last);
        }
      }
    } catch {
      /* optional */
    }
  }

  const asc = sortAscForMetric(metricKey);
  const ranked = [...enriched]
    .filter((r) => metricValue(r, metricKey, periodKey) != null)
    .sort((a, b) => {
      const av = metricValue(a, metricKey, periodKey);
      const bv = metricValue(b, metricKey, periodKey);
      return asc ? av - bv : bv - av;
    });

  // Previous-period ranks for movement arrows (same metric where possible)
  const prevMetric = metricKey === "return" ? "return" : metricKey;
  const prevAsc = sortAscForMetric(prevMetric);
  const prevRanked = [...enriched]
    .filter((r) => {
      if (prevMetric === "return") {
        if (prevPeriodKey === "ytd") return r.returnYtd != null;
        if (prevPeriodKey === "1y") return r.return1y != null;
        if (prevPeriodKey === "3y") return r.return3y != null;
        return r.return5y != null;
      }
      return metricValue(r, prevMetric, periodKey) != null;
    })
    .sort((a, b) => {
      const pick = (row) => {
        if (prevMetric === "return") {
          if (prevPeriodKey === "ytd") return row.returnYtd;
          if (prevPeriodKey === "1y") return row.return1y;
          if (prevPeriodKey === "3y") return row.return3y;
          return row.return5y;
        }
        return metricValue(row, prevMetric, periodKey);
      };
      const av = pick(a);
      const bv = pick(b);
      return prevAsc ? av - bv : bv - av;
    });
  const prevRankMap = new Map(prevRanked.map((r, i) => [r.symbol, i + 1]));

  let withRank = ranked.map((r, i) => {
    const rank = i + 1;
    const previousRank = prevRankMap.get(r.symbol) ?? null;
    const rankDelta = previousRank != null ? previousRank - rank : null; // positive = moved up
    return {
      ...r,
      rank,
      previousRank,
      rankDelta,
      score: metricValue(r, metricKey, periodKey),
    };
  });

  // Optional secondary table column sort after ranking
  if (sort && sort !== "rank" && sort !== metricKey) {
    const dirAsc = String(sortDir).toLowerCase() === "asc";
    withRank = [...withRank].sort((a, b) => {
      const pick = (row) => {
        if (sort === "symbol") return row.symbol;
        if (sort === "name") return row.name;
        if (sort === "price") return row.latestPrice;
        if (sort === "issuer") return row.issuer;
        if (sort === "category") return row.category;
        if (sort === "aum") return row.aumBillions;
        if (sort === "expense") return row.expenseRatio;
        if (sort === "cagr") return row.cagr;
        if (sort === "sharpe") return row.sharpeRatio;
        if (sort === "yield") return row.dividendYieldTtm;
        if (sort === "volatility") return row.volatility1y;
        if (sort === "return") return row.return1y;
        return row.rank;
      };
      const av = pick(a);
      const bv = pick(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return dirAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return dirAsc ? av - bv : bv - av;
    });
  }

  const total = withRank.length;
  const page = withRank.slice(offsetVal, offsetVal + limitVal).map((r, i) => ({
    ...r,
    // Keep absolute rank from metric order even if secondary-sorted display
    displayIndex: offsetVal + i + 1,
  }));

  return {
    category: metricKey,
    metric: metricKey,
    period: periodKey,
    basket: basketId,
    data: page,
    total,
    limit: limitVal,
    offset: offsetVal,
    freeTierLimited: isFree,
  };
}
