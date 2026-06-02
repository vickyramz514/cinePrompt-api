/**
 * Subscription controller - list plans, get user subscription, create, cancel
 */

import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { createSubscription, cancelSubscription, fetchPlan } from '../services/razorpayService.js';
import { ValidationError, NotFoundError, AppError } from '../utils/errors.js';
import { resolvePlanId } from '../utils/razorpayPlanResolver.js';

async function assertRazorpayPlanPricing(plan, razorpayPlanId, mode) {
  let remote;
  try {
    remote = await fetchPlan(razorpayPlanId);
  } catch (err) {
    throw new AppError(
      `Unable to validate Razorpay plan ${razorpayPlanId} in ${mode} mode.`,
      502,
      'BILLING_PLAN_VALIDATION_FAILED',
      {
        hint: `Check Razorpay keys/mode and verify that ${razorpayPlanId} exists in ${mode} dashboard plans.`,
        details: err?.message,
      }
    );
  }
  const expectedAmount = Number(plan.priceCents);
  const expectedCurrency = String(plan.currency || 'INR').toUpperCase();
  const actualAmount = Number(remote?.item?.amount ?? 0);
  const actualCurrency = String(remote?.item?.currency || '').toUpperCase();

  if (actualAmount !== expectedAmount || actualCurrency !== expectedCurrency) {
    throw new AppError(
      `Billing config mismatch for ${plan.slug}: DB=${expectedCurrency} ${expectedAmount} but Razorpay(${mode})=${actualCurrency} ${actualAmount}.`,
      500,
      'BILLING_PLAN_MISMATCH',
      {
        hint: `Fix scripts/razorpay-plans.${mode}.json or update DB subscriptionPlan (${plan.slug}) to match Razorpay.`,
      }
    );
  }
}

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
    if (!plan) {
      throw new NotFoundError(
        'Plan not found.'
      );
    }
    if (plan.priceCents <= 0) {
      throw new ValidationError('Free plan cannot be subscribed');
    }

    const { planId: razorpayPlanId, mode } = resolvePlanId(plan.slug, plan.razorpayPlanId);
    if (!razorpayPlanId) {
      throw new NotFoundError(
        `Plan not configured for Razorpay (${mode} mode). Set scripts/razorpay-plans.${mode}.json or link DB plan IDs.`
      );
    }
    await assertRazorpayPlanPricing(plan, razorpayPlanId, mode);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });

    const { subscriptionId, shortUrl } = await createSubscription(
      razorpayPlanId,
      req.user.id,
      user?.email || null
    );

    res.json({
      success: true,
      data: {
        subscriptionId,
        checkoutUrl: shortUrl,
        /** Public key — same id used client-side for Standard Checkout + callback_url back to the app. */
        razorpayKeyId: config.razorpay.keyId || null,
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
