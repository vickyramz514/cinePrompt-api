/**
 * Subscription controller - list plans, get user subscription, create, cancel
 */

import prisma from '../utils/prisma.js';
import { createSubscription, cancelSubscription } from '../services/razorpayService.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

export const listPlans = async (req, res, next) => {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        priceCents: true,
        currency: true,
        credits: true,
        creditsPerMonth: true,
        billingCycle: true,
        features: true,
      },
    });

    res.json({
      success: true,
      data: { plans },
    });
  } catch (err) {
    next(err);
  }
};

export const getMySubscription = async (req, res, next) => {
  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: {
        userId: req.user.id,
        status: 'ACTIVE',
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            credits: true,
            creditsPerMonth: true,
            priceCents: true,
            billingCycle: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        subscription: subscription || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/subscriptions/create
 * Create Razorpay subscription (returns checkout URL)
 */
export const create = async (req, res, next) => {
  try {
    const { planSlug } = req.body;
    if (!planSlug) {
      throw new ValidationError('planSlug is required');
    }

    const plan = await prisma.subscriptionPlan.findFirst({
      where: { slug: planSlug, isActive: true },
    });
    if (!plan || !plan.razorpayPlanId) {
      throw new NotFoundError(
        'Plan not configured for Razorpay. Run `npm run razorpay:create-plans` to create and link Razorpay plans.'
      );
    }
    if (plan.priceCents <= 0) {
      throw new ValidationError('Free plan cannot be subscribed');
    }

    const { subscriptionId, shortUrl } = await createSubscription(
      plan.razorpayPlanId,
      req.user.id
    );

    res.json({
      success: true,
      data: {
        subscriptionId,
        checkoutUrl: shortUrl,
        planId: plan.id,
        planSlug: plan.slug,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/subscriptions/cancel
 * Cancel Razorpay subscription
 */
export const cancel = async (req, res, next) => {
  try {
    const { subscriptionId } = req.body;
    if (!subscriptionId) {
      throw new ValidationError('subscriptionId is required');
    }

    const userSub = await prisma.userSubscription.findFirst({
      where: {
        userId: req.user.id,
        externalId: subscriptionId,
      },
    });
    if (!userSub) {
      throw new NotFoundError('Subscription not found');
    }

    await cancelSubscription(subscriptionId);

    await prisma.userSubscription.update({
      where: { id: userSub.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
      },
    });

    res.json({
      success: true,
      data: { message: 'Subscription cancelled' },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/subscriptions/status
 * Get current subscription status (alias for /me with status focus)
 */
export const getStatus = async (req, res, next) => {
  try {
    const subscription = await prisma.userSubscription.findFirst({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            credits: true,
            creditsPerMonth: true,
            priceCents: true,
            billingCycle: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: {
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              currentPeriodStart: subscription.currentPeriodStart,
              currentPeriodEnd: subscription.currentPeriodEnd,
              cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
              externalId: subscription.externalId,
              plan: subscription.plan,
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
};
