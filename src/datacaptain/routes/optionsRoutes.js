/**
 * Options Chain routes
 */

import { Router } from "express";
import * as optionsController from "../controllers/optionsController.js";
import { cacheMiddleware, cacheKeys } from "../middlewares/cache.js";

const router = Router();

router.get(
  "/:symbol",
  cacheMiddleware(cacheKeys.optionsChain),
  optionsController.getOptionsChain
);

export default router;
