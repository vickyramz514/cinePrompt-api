/**
 * Insider Trading routes
 */

import { Router } from "express";
import * as insiderController from "../controllers/insiderController.js";

const router = Router();

router.get("/:symbol", insiderController.getInsiderTrades);

export default router;
