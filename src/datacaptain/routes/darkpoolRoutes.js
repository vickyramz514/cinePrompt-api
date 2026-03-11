/**
 * Dark Pool Trades routes
 */

import { Router } from "express";
import * as darkpoolController from "../controllers/darkpoolController.js";

const router = Router();

router.get("/:symbol", darkpoolController.getDarkPoolTrades);

export default router;
