/**
 * Redis cache middleware
 * Caches responses for GET requests
 */

import redis from "../utils/redis.js";
import config from "../config/index.js";

const TTL = config.cache.ttl;

export function cacheMiddleware(cacheKeyFn, ttlOverride) {
  const ttl = ttlOverride ?? TTL;

  return async (req, res, next) => {
    const key = typeof cacheKeyFn === "function" ? cacheKeyFn(req) : cacheKeyFn;
    if (!key) return next();

    try {
      const cached = await redis.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch {
      // Cache miss or error - proceed
    }

    const originalJson = res.json.bind(res);
    res.json = (body) => {
      redis.setex(key, ttl, JSON.stringify(body)).catch(() => {});
      return originalJson(body);
    };
    next();
  };
}

// Cache key generators
export const cacheKeys = {
  stockPrice: (req) => `price:${req.params.symbol}`,
  stockHistory: (req) =>
    `history:${req.params.symbol}:${req.query.startDate}:${req.query.endDate}:${req.query.interval}`,
  stockProfile: (req) => `profile:${req.params.symbol}`,
  topGainers: () => "market:top-gainers",
  topLosers: () => "market:top-losers",
  mostActive: () => "market:most-active",
  aiStockScore: (req) => `ai:stock-score:${req.params.symbol}`,
  marketStatus: () => "market:status",
  batchPrices: (req) => {
    const s = (req.query.symbols || "").replace(/\s/g, "");
    return s ? `batch:prices:${s}` : null;
  },
  etfList: () => "etf:list",
  etfSymbol: (req) => `etf:${req.params.symbol}`,
  optionsChain: (req) =>
    `options:${req.params.symbol}:${req.query.expirationDate || "all"}:${req.query.limit || 50}`,
  insiderTrades: (req) => `insiders:${req.params.symbol}:${req.query.limit || 50}`,
  sentiment: (req) => `sentiment:${req.params.symbol}`,
  economyIndicators: () => "economy:indicators",
  darkpoolTrades: (req) => `darkpool:${req.params.symbol}:${req.query.limit || 50}`,
};

export const CACHE_TTL = {
  SHORT: TTL,
  LONG: 300,
};
