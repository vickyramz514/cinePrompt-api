/**
 * Keep DataCaptain api_users.plan in sync with dashboard subscription / User.plan
 */

import { ApiUser } from "../datacaptain/models/index.js";
import prisma from "./prisma.js";
import {
  bestPlanSlug,
  dailyLimitForPlan,
  isFreePlan,
  normalizePlanSlug,
} from "../datacaptain/config/planAccess.js";

/** Prisma UserPlan enum → api_users.plan slug */
export function prismaUserPlanToSlug(userPlan) {
  if (!userPlan) return "free";
  return String(userPlan).toLowerCase();
}

/**
 * Resolve plan for API requests — uses api_users.plan, User.plan, and active subscription.
 * @param {{ email?: string, plan?: string } | null | undefined} apiUser
 */
export async function resolveEffectivePlanForApiUser(apiUser) {
  const stored = normalizePlanSlug(apiUser?.plan);
  if (!apiUser?.email) return stored;
  if (!isFreePlan(stored)) return stored;

  const user = await prisma.user.findUnique({
    where: { email: apiUser.email },
    select: { id: true, plan: true },
  });
  if (!user) return stored;

  const activeSub = await prisma.userSubscription.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
    include: { plan: { select: { slug: true } } },
    orderBy: { updatedAt: "desc" },
  });

  const effective = bestPlanSlug(
    stored,
    prismaUserPlanToSlug(user.plan),
    activeSub?.plan?.slug
  );

  if (!isFreePlan(effective) && effective !== stored) {
    syncApiUserPlanByEmail(apiUser.email, effective).catch(() => {});
  }

  return effective;
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
