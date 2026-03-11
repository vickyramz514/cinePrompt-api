/**
 * Developer Usage service
 * Returns usage stats from api_usage table
 */

import { ApiUsage } from "../models/index.js";
import { Op } from "sequelize";

export async function getUsageStats(keyId, dailyLimit) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const requestsToday = await ApiUsage.count({
    where: {
      key_id: keyId,
      created_at: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  const plan = "FREE";
  const requestsRemaining = Math.max(0, dailyLimit - requestsToday);

  return {
    plan,
    requestsToday,
    requestsRemaining,
    dailyLimit,
  };
}
