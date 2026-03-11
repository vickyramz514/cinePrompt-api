/**
 * API Key authentication middleware
 * Validates x-api-key header
 */

import { ApiKey, ApiUser } from "../models/index.js";
import crypto from "crypto";
import logger from "../utils/logger.js";

function hashKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function getPrefix(key) {
  return key.substring(0, 12);
}

export async function apiKeyAuth(req, res, next) {
  const key = req.headers["x-api-key"];
  if (!key || typeof key !== "string") {
    return res.status(401).json({
      error: true,
      message: "Missing or invalid API key. Include x-api-key header.",
    });
  }

  const keyHash = hashKey(key);
  const keyPrefix = getPrefix(key);

  try {
    const apiKeys = await ApiKey.findAll({
      where: { key_prefix: keyPrefix, is_active: true },
      include: [{ model: ApiUser }],
    });
    const apiKey = apiKeys.find((k) => k.key_hash === keyHash);

    if (!apiKey) {
      return res.status(401).json({
        error: true,
        message: "Invalid API key",
      });
    }

    req.apiUser = apiKey.ApiUser;
    req.apiKey = apiKey;
    next();
  } catch (err) {
    logger.error("API key auth error:", err);
    res.status(500).json({ error: true, message: "Authentication failed" });
  }
}
