/**
 * Return user with plan aligned to active UserSubscription (fixes stale FREE after payment).
 */

import prisma from './prisma.js';
import { mapPlanSlugToUserPlan } from './subscriptionPlanResolver.js';

export async function enrichUserWithEffectivePlan(user) {
  if (!user?.id) return user;

  const activeSub = await prisma.userSubscription.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { plan: { select: { slug: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  if (!activeSub?.plan?.slug) return user;

  const effectivePlan = mapPlanSlugToUserPlan(activeSub.plan.slug);
  if (user.plan === effectivePlan) return user;

  await prisma.user
    .update({
      where: { id: user.id },
      data: { plan: effectivePlan, planExpiresAt: activeSub.currentPeriodEnd },
    })
    .catch(() => {});

  return { ...user, plan: effectivePlan, planExpiresAt: activeSub.currentPeriodEnd };
}
