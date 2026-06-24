/**
 * API routes - DataCaptain
 */

import { Router } from "express";
import { apiKeyAuth } from "../middlewares/apiKeyAuth.js";
import { planGate } from "../middlewares/planGate.js";
import { rateLimiter } from "../middlewares/rateLimiter.js";
import { cacheMiddleware, cacheKeys } from "../middlewares/cache.js";
import * as stockController from "../controllers/stockController.js";
import * as marketController from "../controllers/marketController.js";
import * as searchController from "../controllers/searchController.js";
import * as screenerController from "../controllers/screenerController.js";
import * as indicatorsController from "../controllers/indicatorsController.js";
import * as aiController from "../controllers/aiController.js";
import * as developerUsageController from "../controllers/developerUsageController.js";
import * as marketStatusController from "../controllers/marketStatusController.js";
import * as batchPricesController from "../controllers/batchPricesController.js";
import * as etfController from "../controllers/etfController.js";
import * as backtestController from "../controllers/backtestController.js";
import * as newsController from "../controllers/newsController.js";
import { usageLogger } from "../middlewares/usageLogger.js";
import optionsRoutes from "./optionsRoutes.js";
import insiderRoutes from "./insiderRoutes.js";
import sentimentRoutes from "./sentimentRoutes.js";
import economyRoutes from "./economyRoutes.js";
import darkpoolRoutes from "./darkpoolRoutes.js";

const router = Router();

// All API routes require API key and rate limiting
router.use(apiKeyAuth);
router.use(planGate);
router.use(rateLimiter);
router.use(usageLogger);

// Batch Stock Prices (before /stocks/:symbol to avoid param conflict)
router.get(
  "/stocks/prices",
  cacheMiddleware(cacheKeys.batchPrices),
  batchPricesController.getBatchPrices
);

// Stock routes
router.get(
  "/stocks/:symbol/price",
  cacheMiddleware(cacheKeys.stockPrice),
  stockController.getPrice
);
router.get(
  "/stocks/:symbol/history",
  cacheMiddleware(cacheKeys.stockHistory),
  stockController.getHistory
);
router.get("/stocks/:symbol/candles", stockController.getCandles);
router.get(
  "/stocks/:symbol/profile",
  cacheMiddleware(cacheKeys.stockProfile),
  stockController.getProfile
);
router.get(
  "/stocks/:symbol/snapshot",
  cacheMiddleware(cacheKeys.stockSnapshot),
  stockController.getSnapshot
);
router.get(
  "/stocks/:symbol/news",
  cacheMiddleware(cacheKeys.stockNews),
  newsController.getNews
);
router.get("/stocks/:symbol/dividends", stockController.getDividends);
router.get("/stocks/:symbol/earnings", stockController.getEarnings);

// Market routes
// Market status (cached 60s)
router.get(
  "/market/status",
  cacheMiddleware(cacheKeys.marketStatus),
  marketStatusController.getStatus
);
router.get(
  "/market/earnings-calendar",
  cacheMiddleware(cacheKeys.earningsCalendar),
  marketController.getEarningsCalendar
);

router.get(
  "/market/top-gainers",
  cacheMiddleware(cacheKeys.topGainers),
  marketController.getTopGainers
);
router.get(
  "/market/top-losers",
  cacheMiddleware(cacheKeys.topLosers),
  marketController.getTopLosers
);
router.get(
  "/market/most-active",
  cacheMiddleware(cacheKeys.mostActive),
  marketController.getMostActive
);

// Search
router.get("/search", searchController.search);

// Stock Screener
router.get("/screener", screenerController.screen);

// Technical Indicators
router.get("/indicators/:symbol", indicatorsController.getIndicators);

// AI Stock Score (cached 60s)
router.get(
  "/ai/stock-score/:symbol",
  cacheMiddleware(cacheKeys.aiStockScore),
  aiController.getStockScore
);

// Developer Usage
router.get("/developer/usage", developerUsageController.getUsage);

// ETF endpoints
router.get(
  "/etf/list",
  cacheMiddleware(cacheKeys.etfList),
  etfController.getEtfList
);
router.get(
  "/etf/:symbol",
  cacheMiddleware(cacheKeys.etfSymbol),
  etfController.getEtfBySymbol
);

// Backtesting & portfolio tools
router.post("/backtest/buy-and-hold", backtestController.runBuyAndHold);
router.get("/backtest/buy-and-hold", backtestController.runBuyAndHold);
router.post("/backtest/compare", backtestController.compareSymbols);
router.get("/backtest/compare", backtestController.compareSymbols);

// Premium data APIs
router.use("/options", optionsRoutes);
router.use("/insiders", insiderRoutes);
router.use("/sentiment", sentimentRoutes);
router.use("/economy", economyRoutes);
router.use("/darkpool", darkpoolRoutes);

export default router;
