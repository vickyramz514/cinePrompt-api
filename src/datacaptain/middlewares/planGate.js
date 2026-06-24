/**
 * Blocks premium DataCaptain endpoints for free-plan API users.
 */

import {
  isApiPathAllowedForPlan,
} from "../config/planAccess.js";
import { resolveEffectivePlanForApiUser } from "../../utils/syncApiUserPlan.js";

export async function planGate(req, res, next) {
  const plan = await resolveEffectivePlanForApiUser(req.apiUser);
  const path = req.path || "";

  if (isApiPathAllowedForPlan(path, req.method, plan)) {
    return next();
  }

  return res.status(403).json({
    error: true,
    code: "PLAN_UPGRADE_REQUIRED",
    message:
      "This endpoint is not included on the Free plan. Upgrade to Starter or Pro to access full market data APIs.",
    plan,
    path,
    upgradeUrl: "/dashboard/wallet",
  });
}
