/**
 * Return user with plan aligned to active UserSubscription (fixes stale FREE after payment).
 * Respects admin/manual plan overrides — never downgrades a higher User.plan.
 */

import prisma from './prisma.js';
import { bestPlanSlug } from '../datacaptain/config/planAccess.js';
import { mapPlanSlugToUserPlan } from './subscriptionPlanResolver.js';
import { prismaUserPlanToSlug } from './syncApiUserPlan.js';

export async function enrichUserWithEffectivePlan(user) {
  if (!user?.id) return user;

  const activeSub = await prisma.userSubscription.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { plan: { select: { slug: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  const effectiveSlug = bestPlanSlug(
    prismaUserPlanToSlug(user.plan),
    activeSub?.plan?.slug
  );
  const effectivePlan = mapPlanSlugToUserPlan(effectiveSlug);

  if (user.plan === effectivePlan) {
    return {
      ...user,
      planExpiresAt: activeSub?.currentPeriodEnd ?? user.planExpiresAt,
    };
  }

  await prisma.user
    .update({
      where: { id: user.id },
      data: {
        plan: effectivePlan,
        planExpiresAt: activeSub?.currentPeriodEnd ?? user.planExpiresAt,
      },
    })
    .catch(() => {});

  return {
    ...user,
    plan: effectivePlan,
    planExpiresAt: activeSub?.currentPeriodEnd ?? user.planExpiresAt,
  };
}
