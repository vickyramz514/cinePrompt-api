/**
 * Developer Usage controller
 */

import * as developerUsageService from "../services/developerUsageService.js";

export async function getUsage(req, res, next) {
  try {
    const keyId = req.apiKey?.id;
    const dailyLimit = req.apiUser?.daily_limit ?? 1000;

    if (!keyId) {
      return res.status(401).json({
        error: true,
        message: "API key required",
      });
    }

    const data = await developerUsageService.getUsageStats(
      keyId,
      dailyLimit,
      req.apiUser
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
}
