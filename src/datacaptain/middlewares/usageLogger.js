/**
 * API Usage Logger middleware
 * Records every API request to api_usage table
 * - Records request start time
 * - On response finish: calculates response time, inserts record
 */

import { ApiUsage } from "../models/index.js";
import logger from "../utils/logger.js";

export function usageLogger(req, res, next) {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    const statusCode = res.statusCode;

    const keyId = req.apiKey?.id;
    const apiKeyMasked =
      req.apiKey?.key_prefix ?? req.headers["x-api-key"]?.substring(0, 12) ?? "unknown";
    const endpoint = req.originalUrl?.split("?")[0] ?? req.path ?? "unknown";
    const method = req.method ?? "GET";

    if (!keyId) {
      return;
    }

    ApiUsage.create({
      key_id: keyId,
      api_key: apiKeyMasked,
      endpoint,
      method,
      response_time: responseTime,
      status_code: statusCode,
    }).catch((err) => {
      logger.error("Usage logger failed to insert record:", err.message);
    });
  });

  next();
}
