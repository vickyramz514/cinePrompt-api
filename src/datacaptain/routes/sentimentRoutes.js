/**
 * Stock Sentiment routes
 */

import { Router } from "express";
import * as sentimentController from "../controllers/sentimentController.js";
import { cacheMiddleware, cacheKeys } from "../middlewares/cache.js";

const router = Router();

router.get(
  "/:symbol",
  cacheMiddleware(cacheKeys.sentiment),
  sentimentController.getSentiment
);

export default router;
