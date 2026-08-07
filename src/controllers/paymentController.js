/**
 * Payment controller - Razorpay subscription checkout & webhook
 * Frontend calls create-subscription; Razorpay calls webhook
 */

import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { createSubscription, fetchPlan } from '../services/razorpayService.js';
import { addCreditsSubscription } from '../services/creditService.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError, AppError, ForbiddenError } from '../utils/errors.js';
import { syncApiUserPlanByEmail } from '../utils/syncApiUserPlan.js';
import { resolvePlanId } from '../utils/razorpayPlanResolver.js';
import {
  findSubscriptionPlanByRazorpayId,
  mapPlanSlugToUserPlan,
} from '../utils/subscriptionPlanResolver.js';
import { activateSubscriptionFromRazorpayEntity } from '../services/subscriptionActivationService.js';

function isAdminUser(user) {
  return user && ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
}

function assertPlanSubscribeAccess(plan, user) {
  if (plan.adminOnly && !isAdminUser(user)) {
    throw new ForbiddenError('This plan is only available to admin users');
  }
}

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

/**
 * POST /api/payment/create-subscription
 * Create Razorpay subscription link for checkout
 */
export const createSubscriptionCheckout = async (req, res, next) => {
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
    assertPlanSubscribeAccess(plan, req.user);
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
 * POST /api/payment/webhook
 * Razorpay webhook - NO AUTH, verify signature only
 * Body must be raw (express.raw) for signature verification
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody; // Set by express.raw() middleware

    if (!rawBody || !signature) {
      logger.warn('Webhook: missing body or signature');
      return res.status(400).json({ error: 'Invalid webhook' });
    }

    const { verifyWebhookSignature } = await import('../services/razorpayService.js');
    if (!verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Webhook: invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    const eventType = event.event;

    logger.info('Webhook received', { event: eventType });

    switch (eventType) {
      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload);
        break;
      case 'subscription.activated':
        await handleSubscriptionActivated(event.payload);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.payload);
        break;
      case 'subscription.completed':
      case 'subscription.halted':
      case 'subscription.pending':
        // Log only
        logger.info('Webhook event (no action)', { event: eventType });
        break;
      case 'payment.captured':
        // One-time payment - if we use it later
        logger.info('Payment captured (one-time)', { payload: event.payload });
        break;
      case 'payment.failed':
        logger.warn('Payment failed', { payload: event.payload });
        break;
      default:
        logger.info('Unhandled webhook event', { event: eventType });
    }

    res.status(200).json({ received: true });
  } catch (err) {
    logger.error('Webhook error', { error: err.message, stack: err.stack });
    next(err);
  }
};

async function handleSubscriptionCharged(payload) {
  const subscription = payload.subscription?.entity || payload.subscription;
  const payment = payload.payment?.entity || payload.payment;

  if (!subscription || !payment) {
    logger.warn('subscription.charged: missing subscription or payment');
    return;
  }

  const razorpaySubId = subscription.id;
  const razorpayPaymentId = payment.id;
  const amountPaise = payment.amount || 0;

  // Idempotency: check if we already processed this payment
  const existing = await prisma.payment.findFirst({
    where: { providerId: razorpayPaymentId, provider: 'RAZORPAY' },
  });
  if (existing) {
    logger.info('subscription.charged: already processed', { paymentId: razorpayPaymentId });
    return;
  }

  // Find user from our UserSubscription by razorpay sub id
  let userSub = await prisma.userSubscription.findFirst({
    where: { externalId: razorpaySubId },
    include: { plan: true, user: true },
  });

  // If charged arrives before activated, create UserSubscription from payload
  if (!userSub) {
    const plan = await findSubscriptionPlanByRazorpayId(subscription.plan_id);
    const notes = subscription.notes || {};
    const userId = notes.user_id || notes.userId;
    if (!plan || !userId) {
      logger.warn('subscription.charged: cannot resolve user/plan', {
        planId: subscription.plan_id,
        notes,
      });
      return;
    }
    const currentStart = subscription.current_start
      ? new Date(subscription.current_start * 1000)
      : new Date();
    const currentEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    userSub = await prisma.userSubscription.create({
      data: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        externalId: razorpaySubId,
      },
      include: { plan: true, user: true },
    });
  }

  const userId = userSub.userId;
  const credits = userSub.plan.creditsPerMonth ?? userSub.plan.credits;

  await prisma.$transaction(async (tx) => {
    await addCreditsSubscription(userId, credits, razorpayPaymentId, razorpaySubId);

    await tx.payment.create({
      data: {
        userId,
        amountCents: amountPaise,
        currency: 'INR',
        status: 'COMPLETED',
        provider: 'RAZORPAY',
        providerId: razorpayPaymentId,
        creditsAdded: credits,
        subscriptionId: razorpaySubId,
        providerData: { subscription, payment },
      },
    });

    // Update period on UserSubscription
    const currentStart = subscription.current_start
      ? new Date(subscription.current_start * 1000)
      : userSub.currentPeriodStart;
    const currentEnd = subscription.current_end
      ? new Date(subscription.current_end * 1000)
      : userSub.currentPeriodEnd;

    await tx.userSubscription.update({
      where: { id: userSub.id },
      data: {
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
      },
    });

    // Update User.plan so profile shows correct plan
    await tx.user.update({
      where: { id: userId },
      data: {
        plan: mapPlanSlugToUserPlan(userSub.plan.slug),
        planExpiresAt: currentEnd,
      },
    });
  });

  const chargedUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (chargedUser?.email) {
    await syncApiUserPlanByEmail(chargedUser.email, userSub.plan.slug).catch(() => {});
  }

  const { recordCommission } = await import('../services/referralService.js');
  const { trackEvent } = await import('../services/growthAnalyticsService.js');
  const amountCents = Math.round(amountPaise);
  recordCommission(userId, amountCents, razorpayPaymentId).catch(() => {});
  trackEvent('payment_done', userId, { amountCents, subscriptionId: razorpaySubId }).catch(() => {});

  logger.info('subscription.charged: credits added', {
    userId,
    credits,
    paymentId: razorpayPaymentId,
  });
}

async function handleSubscriptionActivated(payload) {
  const subscription = payload.subscription?.entity || payload.subscription;
  if (!subscription) return;

  const result = await activateSubscriptionFromRazorpayEntity(subscription);
  if (!result.ok) {
    logger.warn('subscription.activated: not applied', result);
    return;
  }

  const { trackEvent } = await import('../services/growthAnalyticsService.js');
  trackEvent('subscription_started', result.userId, { planSlug: result.planSlug }).catch(() => {});
}

async function handleSubscriptionCancelled(payload) {
  const subscription = payload.subscription?.entity || payload.subscription;
  if (!subscription) return;

  const razorpaySubId = subscription.id;

  const subs = await prisma.userSubscription.findMany({
    where: { externalId: razorpaySubId },
  });
  const userIds = [...new Set(subs.map((s) => s.userId))];

  await prisma.userSubscription.updateMany({
    where: { externalId: razorpaySubId },
    data: {
      status: 'CANCELLED',
      cancelledAt: new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  for (const userId of userIds) {
    const otherActive = await prisma.userSubscription.findFirst({
      where: { userId, status: 'ACTIVE', externalId: { not: razorpaySubId } },
      include: { plan: true },
    });
    const nextSlug = otherActive ? otherActive.plan.slug : 'free';
    await prisma.user.update({
      where: { id: userId },
      data: otherActive
        ? { plan: mapPlanSlugToUserPlan(otherActive.plan.slug), planExpiresAt: otherActive.currentPeriodEnd }
        : { plan: 'FREE', planExpiresAt: null },
    });
    const cancelledUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (cancelledUser?.email) {
      await syncApiUserPlanByEmail(cancelledUser.email, nextSlug).catch(() => {});
    }
  }

  const { trackEvent } = await import('../services/growthAnalyticsService.js');
  for (const userId of userIds) {
    trackEvent('subscription_cancelled', userId, {}).catch(() => {});
  }

  logger.info('subscription.cancelled', { razorpaySubId });
}
