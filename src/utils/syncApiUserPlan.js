/**
 * Keep DataCaptain api_users.plan in sync with dashboard subscription / User.plan
 */

import { ApiUser } from "../datacaptain/models/index.js";
import {
  dailyLimitForPlan,
  normalizePlanSlug,
} from "../datacaptain/config/planAccess.js";

/** Prisma UserPlan enum → api_users.plan slug */
export function prismaUserPlanToSlug(userPlan) {
  if (!userPlan) return "free";
  return String(userPlan).toLowerCase();
}

/**
 * @param {string} email
 * @param {string} [planSlug]
 */
export async function syncApiUserPlanByEmail(email, planSlug) {
  if (!email) return null;
  const plan = normalizePlanSlug(planSlug);
  const daily_limit = dailyLimitForPlan(plan);
  const apiUser = await ApiUser.findOne({ where: { email } });
  if (!apiUser) return null;
  await apiUser.update({ plan, daily_limit });
  return apiUser;
}

/**
 * @param {{ email?: string, plan?: string }} user - Prisma User or JWT payload with plan
 */
export async function syncApiUserPlanFromUser(user) {
  if (!user?.email) return null;
  const slug = prismaUserPlanToSlug(user.plan);
  return syncApiUserPlanByEmail(user.email, slug);
}
