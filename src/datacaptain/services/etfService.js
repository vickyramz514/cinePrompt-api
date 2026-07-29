/**
 * ETF Data service
 * List and detail from stocks + historical_prices + etf_metrics
 */

import { QueryTypes, Op } from "sequelize";
import sequelize from "../config/database.js";
import { Stock, HistoricalPrice, Dividend, EtfMetrics } from "../models/index.js";
import {
  ETF_STATIC_META,
  HEATMAP_BASKETS,
  inferIssuer,
  classifyEtf,
  symbolsForCategory,
} from "../constants/etfBaskets.js";

const POPULAR_SYMBOLS = ["SPY", "QQQ", "VTI", "DIA", "ARKK"];
const DEFAULT_LIMIT = 48;
const MAX_LIMIT = 200;

function clampLimit(limit) {
  const n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

function clampOffset(offset) {
  const n = parseInt(offset, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function roundPct(value) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

function enrichRow(r) {
  const symbol = r.symbol;
  const name = r.name;
  const meta = ETF_STATIC_META[symbol] || {};
  const cls = classifyEtf(symbol);
  const return1y = r.return_1y != null ? parseFloat(r.return_1y) : null;
  const volatility1y = r.volatility_1y != null ? parseFloat(r.volatility_1y) : null;
  const sharpeRatio =
    return1y != null && volatility1y != null && volatility1y > 0
      ? roundPct(return1y / volatility1y)
      : null;
  const return3y = r.return_3y != null ? parseFloat(r.return_3y) : null;
  const cagr =
    return3y != null ? roundPct((Math.pow(1 + return3y / 100, 1 / 3) - 1) * 100) : return1y;

  return {
    symbol,
    name,
    price: r.price != null ? parseFloat(r.price) : r.latest_price != null ? parseFloat(r.latest_price) : null,
    exchange: r.exchange_code ?? null,
    returnYtd: r.return_ytd != null ? parseFloat(r.return_ytd) : null,
    return1y,
    return3y,
    return5y: r.return_5y != null ? parseFloat(r.return_5y) : null,
    dividendYieldTtm: r.dividend_yield_ttm != null ? parseFloat(r.dividend_yield_ttm) : null,
    volatility1y,
    avgVolume30d: r.avg_volume_30d ? Number(r.avg_volume_30d) : null,
    assetClass: r.asset_class ?? null,
    aumBillions: meta.aumBillions ?? null,
    expenseRatio: meta.expenseRatio ?? null,
    sharpeRatio,
    cagr,
    issuer: inferIssuer(symbol, name),
    category: cls.category,
    badges: cls.badges,
    leveraged: cls.leveraged,
    inverse: cls.inverse,
    esg: cls.esg,
    country: "US",
    currency: "USD",
    change1d: r.change1d != null ? roundPct(r.change1d) : null,
    asOf: r.as_of_date ?? r.price_date ?? null,
  };
}

/**
 * @param {object} opts
 */
export async function getEtfList(opts = {}) {
  const limit = clampLimit(opts.limit);
  const offset = clampOffset(opts.offset);
  const search = (opts.search || "").trim();
  const hasPrice =
    opts.hasPrice === true ||
    opts.hasPrice === "1" ||
    opts.hasPrice === "true" ||
    opts.hasPrice == null; // default priced ETFs for explorer UX

  const category = opts.category || opts.basket || "";
  const issuer = (opts.issuer || "").trim();
  const assetClass = (opts.assetClass || "").trim();
  const leveraged = opts.leveraged === "1" || opts.leveraged === "true";
  const inverse = opts.inverse === "1" || opts.inverse === "true";
  const dividendMin = opts.dividendMin != null && opts.dividendMin !== "" ? parseFloat(opts.dividendMin) : null;
  const expenseMax = opts.expenseMax != null && opts.expenseMax !== "" ? parseFloat(opts.expenseMax) : null;
  const aumMin = opts.aumMin != null && opts.aumMin !== "" ? parseFloat(opts.aumMin) : null;
  const volumeMin = opts.volumeMin != null && opts.volumeMin !== "" ? parseFloat(opts.volumeMin) : null;
  const sort = opts.sort || "symbol";
  const sortDir = String(opts.sortDir || "asc").toLowerCase() === "desc" ? "DESC" : "ASC";

  const whereParts = [`s.type = 'ETF'`, `(s.is_active IS NULL OR s.is_active = true)`];
  const replacements = {};

  if (search) {
    whereParts.push(`(s.symbol ILIKE :search OR s.name ILIKE :search)`);
    replacements.search = `%${search}%`;
  }
  if (hasPrice) {
    whereParts.push(`m.symbol IS NOT NULL`);
  }
  if (assetClass) {
    whereParts.push(`m.asset_class ILIKE :assetClass`);
    replacements.assetClass = `%${assetClass}%`;
  }
  if (dividendMin != null && !Number.isNaN(dividendMin)) {
    whereParts.push(`m.dividend_yield_ttm >= :dividendMin`);
    replacements.dividendMin = dividendMin;
  }
  if (volumeMin != null && !Number.isNaN(volumeMin)) {
    whereParts.push(`m.avg_volume_30d >= :volumeMin`);
    replacements.volumeMin = volumeMin;
  }

  const basketSymbols = symbolsForCategory(category);
  if (basketSymbols?.length) {
    whereParts.push(`s.symbol IN (:basketSymbols)`);
    replacements.basketSymbols = basketSymbols;
  }
  if (leveraged) {
    whereParts.push(`s.symbol IN (:leveragedSymbols)`);
    replacements.leveragedSymbols = HEATMAP_BASKETS.leveraged.symbols;
  }
  if (inverse) {
    whereParts.push(`s.symbol IN (:inverseSymbols)`);
    replacements.inverseSymbols = HEATMAP_BASKETS.inverse.symbols;
  }

  const whereClause = whereParts.join(" AND ");

  const sqlSortMap = {
    price: "COALESCE(m.latest_price, hp.close)",
    return: "m.return_1y",
    volume: "m.avg_volume_30d",
    yield: "m.dividend_yield_ttm",
    symbol: "s.symbol",
    name: "s.name",
  };
  const needsMetaSort = ["expense", "aum"].includes(sort);
  const orderCol = sqlSortMap[sort] || "s.symbol";

  // Pull a wider pool when meta filters/sort need post-processing
  const poolLimit = needsMetaSort || issuer || expenseMax != null || aumMin != null ? 600 : limit;
  const poolOffset = needsMetaSort || issuer || expenseMax != null || aumMin != null ? 0 : offset;

  const rows = await sequelize.query(
    `
    SELECT s.symbol, s.name, s.exchange_code,
      COALESCE(m.latest_price, hp.close) AS price,
      hp.date AS price_date,
      m.as_of_date, m.return_ytd, m.return_1y, m.return_3y, m.return_5y,
      m.dividend_yield_ttm, m.volatility_1y, m.avg_volume_30d, m.asset_class, m.latest_price
    FROM stocks s
    LEFT JOIN etf_metrics m ON m.symbol = s.symbol
    LEFT JOIN LATERAL (
      SELECT close, date FROM historical_prices hp2
      WHERE hp2.symbol = s.symbol
      ORDER BY hp2.date DESC
      LIMIT 1
    ) hp ON true
    WHERE ${whereClause}
    ORDER BY ${orderCol} ${sortDir} NULLS LAST, s.symbol ASC
    LIMIT ${poolLimit} OFFSET ${poolOffset}
    `,
    { replacements, type: QueryTypes.SELECT }
  );

  let enriched = rows.map(enrichRow);

  // 1d change for page (batch recent prices) — optional lightweight
  try {
    const symbols = enriched.slice(0, limit + offset).map((e) => e.symbol).slice(0, 80);
    if (symbols.length) {
      const recent = await HistoricalPrice.findAll({
        where: { symbol: { [Op.in]: symbols } },
        order: [
          ["symbol", "ASC"],
          ["date", "DESC"],
        ],
        attributes: ["symbol", "close"],
        raw: true,
        limit: symbols.length * 3,
      });
      const bySym = new Map();
      for (const r of recent) {
        if (!bySym.has(r.symbol)) bySym.set(r.symbol, []);
        const arr = bySym.get(r.symbol);
        if (arr.length < 2) arr.push(parseFloat(r.close));
      }
      enriched = enriched.map((e) => {
        const closes = bySym.get(e.symbol);
        if (closes?.length >= 2 && closes[1] > 0) {
          return { ...e, change1d: roundPct(((closes[0] - closes[1]) / closes[1]) * 100) };
        }
        return e;
      });
    }
  } catch {
    /* optional */
  }

  if (issuer) {
    const q = issuer.toLowerCase();
    enriched = enriched.filter((e) => e.issuer.toLowerCase().includes(q));
  }
  if (expenseMax != null && !Number.isNaN(expenseMax)) {
    enriched = enriched.filter((e) => e.expenseRatio != null && e.expenseRatio <= expenseMax);
  }
  if (aumMin != null && !Number.isNaN(aumMin)) {
    enriched = enriched.filter((e) => e.aumBillions != null && e.aumBillions >= aumMin);
  }
  if (search) {
    const q = search.toLowerCase();
    enriched = enriched.filter(
      (e) =>
        e.symbol.toLowerCase().includes(q) ||
        e.name.toLowerCase().includes(q) ||
        e.issuer.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }

  if (needsMetaSort) {
    const asc = sortDir === "ASC";
    enriched.sort((a, b) => {
      const av = sort === "expense" ? a.expenseRatio : a.aumBillions;
      const bv = sort === "expense" ? b.expenseRatio : b.aumBillions;
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      return asc ? av - bv : bv - av;
    });
  }

  // Stats for hero cards
  const [statsRow] = await sequelize.query(
    `
    SELECT
      COUNT(*) FILTER (WHERE s.type = 'ETF' AND (s.is_active IS NULL OR s.is_active = true))::int AS total_etfs,
      COUNT(m.symbol)::int AS with_metrics,
      AVG(m.avg_volume_30d)::float AS avg_volume,
      MAX(m.as_of_date) AS as_of,
      (SELECT COUNT(*)::bigint FROM historical_prices) AS price_bars
    FROM stocks s
    LEFT JOIN etf_metrics m ON m.symbol = s.symbol
    WHERE s.type = 'ETF' AND (s.is_active IS NULL OR s.is_active = true)
    `,
    { type: QueryTypes.SELECT }
  );

  const total = enriched.length;
  const page = enriched.slice(
    needsMetaSort || issuer || expenseMax != null || aumMin != null ? offset : 0,
    (needsMetaSort || issuer || expenseMax != null || aumMin != null ? offset : 0) + limit
  );

  // When SQL already paginated, total from count query
  let totalOut = total;
  if (!(needsMetaSort || issuer || expenseMax != null || aumMin != null)) {
    const [countRow] = await sequelize.query(
      `SELECT COUNT(*)::int AS total
       FROM stocks s
       LEFT JOIN etf_metrics m ON m.symbol = s.symbol
       WHERE ${whereClause}`,
      { replacements, type: QueryTypes.SELECT }
    );
    totalOut = countRow?.total ?? page.length;
  }

  return {
    data: page,
    total: totalOut,
    limit,
    offset,
    hasPrice,
    stats: {
      totalEtfs: statsRow?.total_etfs ?? 0,
      withHistory: statsRow?.with_metrics ?? 0,
      priceBars: Number(statsRow?.price_bars ?? 0),
      categories: Object.keys(HEATMAP_BASKETS).length,
      avgVolume: statsRow?.avg_volume != null ? Math.round(statsRow.avg_volume) : null,
      asOf: statsRow?.as_of ?? null,
    },
  };
}

function computeReturn(start, end) {
  if (start == null || end == null || start <= 0) return null;
  return roundPct(((end - start) / start) * 100);
}

function maxDrawdown(closes) {
  if (!closes?.length) return null;
  let peak = closes[0];
  let maxDd = 0;
  for (const p of closes) {
    if (p > peak) peak = p;
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - p) / peak) * 100);
  }
  return roundPct(maxDd);
}

export async function getEtfBySymbol(symbol) {
  const sym = symbol?.toUpperCase();
  if (!sym) return null;

  const [stock, priceRows, metrics, dividends] = await Promise.all([
    Stock.findOne({ where: { symbol: sym, type: "ETF" }, raw: true }),
    HistoricalPrice.findAll({
      where: { symbol: sym },
      order: [["date", "ASC"]],
      attributes: ["date", "open", "high", "low", "close", "volume"],
      raw: true,
      limit: 4000,
    }),
    EtfMetrics.findByPk(sym, { raw: true }).catch(() => null),
    Dividend.findAll({
      where: { symbol: sym },
      order: [["ex_date", "DESC"]],
      limit: 24,
      raw: true,
    }).catch(() => []),
  ]);

  if (!stock) return null;

  const prices = priceRows.map((r) => ({
    date: typeof r.date === "string" ? r.date.slice(0, 10) : r.date?.toISOString?.().slice(0, 10),
    open: parseFloat(r.open),
    high: parseFloat(r.high),
    low: parseFloat(r.low),
    close: parseFloat(r.close),
    volume: r.volume ? Number(r.volume) : 0,
  }));

  const latest = prices[prices.length - 1] || null;
  const prev = prices.length >= 2 ? prices[prices.length - 2] : null;
  const closes = prices.map((p) => p.close);

  const findCloseOnOrBefore = (target) => {
    let result = null;
    for (const p of prices) {
      if (p.date <= target) result = p;
      else break;
    }
    return result;
  };

  const addDays = (dateStr, days) => {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const latestDate = latest?.date;
  const yearAgo = latestDate ? addDays(latestDate, -365) : null;
  const window52 = yearAgo ? prices.filter((p) => p.date >= yearAgo) : prices.slice(-252);
  const high52 = window52.length ? Math.max(...window52.map((p) => p.high || p.close)) : null;
  const low52 = window52.length ? Math.min(...window52.map((p) => p.low || p.close)) : null;

  const performance = latestDate
    ? {
        "1d": prev ? computeReturn(prev.close, latest.close) : null,
        "1w": computeReturn(findCloseOnOrBefore(addDays(latestDate, -7))?.close, latest.close),
        "1m": computeReturn(findCloseOnOrBefore(addDays(latestDate, -30))?.close, latest.close),
        "3m": computeReturn(findCloseOnOrBefore(addDays(latestDate, -91))?.close, latest.close),
        "6m": computeReturn(findCloseOnOrBefore(addDays(latestDate, -182))?.close, latest.close),
        ytd: computeReturn(findCloseOnOrBefore(`${latestDate.slice(0, 4)}-01-01`)?.close, latest.close),
        "1y": metrics?.return_1y != null ? parseFloat(metrics.return_1y) : computeReturn(findCloseOnOrBefore(addDays(latestDate, -365))?.close, latest.close),
        "3y": metrics?.return_3y != null ? parseFloat(metrics.return_3y) : computeReturn(findCloseOnOrBefore(addDays(latestDate, -365 * 3))?.close, latest.close),
        "5y": metrics?.return_5y != null ? parseFloat(metrics.return_5y) : computeReturn(findCloseOnOrBefore(addDays(latestDate, -365 * 5))?.close, latest.close),
        "10y": computeReturn(findCloseOnOrBefore(addDays(latestDate, -365 * 10))?.close, latest.close),
      }
    : {};

  const base = enrichRow({
    symbol: sym,
    name: stock.name ?? sym,
    exchange_code: stock.exchange_code,
    price: latest?.close,
    latest_price: metrics?.latest_price,
    as_of_date: metrics?.as_of_date,
    return_ytd: metrics?.return_ytd,
    return_1y: metrics?.return_1y,
    return_3y: metrics?.return_3y,
    return_5y: metrics?.return_5y,
    dividend_yield_ttm: metrics?.dividend_yield_ttm,
    volatility_1y: metrics?.volatility_1y,
    avg_volume_30d: metrics?.avg_volume_30d,
    asset_class: metrics?.asset_class,
    change1d: performance["1d"],
  });

  const vol = base.volatility1y;
  const beta = vol != null ? roundPct(vol / 16) : null; // rough vs ~16% market vol

  // Similar ETFs: same category basket
  const cls = classifyEtf(sym);
  let similarSymbols = [];
  for (const [id, basket] of Object.entries(HEATMAP_BASKETS)) {
    if (basket.symbols.includes(sym)) {
      similarSymbols = basket.symbols.filter((s) => s !== sym).slice(0, 6);
      break;
    }
  }
  if (!similarSymbols.length) {
    similarSymbols = HEATMAP_BASKETS.broad.symbols.filter((s) => s !== sym).slice(0, 6);
  }

  const similarRows = await sequelize.query(
    `
    SELECT s.symbol, s.name, m.latest_price AS price, m.return_1y, m.dividend_yield_ttm, m.volatility_1y
    FROM stocks s
    LEFT JOIN etf_metrics m ON m.symbol = s.symbol
    WHERE s.symbol IN (:symbols)
    `,
    { replacements: { symbols: similarSymbols }, type: QueryTypes.SELECT }
  );

  const similar = similarRows.map((r) => enrichRow({ ...r, exchange_code: null }));

  const summaryParts = [
    `${base.name} (${sym}) is classified as a ${base.category} ETF`,
    base.issuer !== "Other" ? `issued by ${base.issuer}` : null,
    base.expenseRatio != null ? `with an estimated expense ratio of ${base.expenseRatio}%` : null,
    base.aumBillions != null ? `and roughly $${base.aumBillions}B AUM` : null,
    performance["1y"] != null ? `1-year return ${performance["1y"] > 0 ? "+" : ""}${performance["1y"]}%` : null,
    base.volatility1y != null ? `1-year volatility ~${base.volatility1y}%` : null,
  ].filter(Boolean);

  const aiSummary =
    summaryParts.length > 1
      ? `${summaryParts.join(", ")}. Data Captain metrics are derived from historical prices; holdings and live fund filings are not included in this dataset.`
      : `${base.name} (${sym}). Connect price history for a fuller research profile.`;

  return {
    ...base,
    type: "ETF",
    date: latest?.date ?? null,
    open: latest?.open ?? null,
    high: latest?.high ?? null,
    low: latest?.low ?? null,
    volume: latest?.volume ?? null,
    change1d: performance["1d"],
    high52w: high52,
    low52w: low52,
    beta,
    maxDrawdown: maxDrawdown(closes.slice(-252)),
    performance,
    history: prices,
    sparkline: closes.slice(-30),
    dividends: (dividends || []).map((d) => ({
      exDate: d.ex_date,
      amount: d.amount != null ? parseFloat(d.amount) : null,
    })),
    similar,
    aiSummary,
    holdingsNote:
      "Top holdings and official sector/geographic weights are not in the current metrics dataset. Use category baskets and similar ETFs for research context.",
    risk: {
      volatility1y: base.volatility1y,
      sharpeRatio: base.sharpeRatio,
      maxDrawdown: maxDrawdown(closes.slice(-252)),
      beta,
      rating:
        base.leveraged || base.inverse
          ? "Elevated"
          : base.volatility1y != null && base.volatility1y > 25
            ? "Higher"
            : "Moderate",
    },
  };
}

export { POPULAR_SYMBOLS };
