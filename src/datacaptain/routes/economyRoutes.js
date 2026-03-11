/**
 * Economic Indicators routes
 */

import { Router } from "express";
import * as economyController from "../controllers/economyController.js";
import { cacheMiddleware, cacheKeys, CACHE_TTL } from "../middlewares/cache.js";

const router = Router();

router.get(
  "/indicators",
  cacheMiddleware(cacheKeys.economyIndicators, CACHE_TTL.LONG),
  economyController.getIndicators
);

export default router;
