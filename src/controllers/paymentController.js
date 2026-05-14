/**
 * Payment controller - Razorpay subscription checkout & webhook
 * Frontend calls create-subscription; Razorpay calls webhook
 */

import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { createSubscription } from '../services/razorpayService.js';
import { addCreditsSubscription } from '../services/creditService.js';
import { logger } from '../utils/logger.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

/** Map SubscriptionPlan slug to UserPlan enum */
function mapPlanSlugToUserPlan(slug) {
  const m = { free: 'FREE', starter: 'STARTER', creator: 'CREATOR', pro: 'PRO', ultra: 'ULTRA' };
  return (m[slug?.toLowerCase()] || 'FREE');
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
    if (!plan || !plan.razorpayPlanId) {
      throw new NotFoundError(
        'Plan not configured for Razorpay. On the API server, run: npm run razorpay:create-plans (set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET).'
      );
    }
    if (plan.priceCents <= 0) {
      throw new ValidationError('Free plan cannot be subscribed');
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });

    const { subscriptionId, shortUrl } = await createSubscription(
      plan.razorpayPlanId,
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
    const plan = await prisma.subscriptionPlan.findFirst({
      where: { razorpayPlanId: subscription.plan_id },
    });
    const notes = subscription.notes || {};
    const userId = notes.user_id;
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

  const razorpaySubId = subscription.id;
  const planId = subscription.plan_id;

  // Find our plan by razorpayPlanId
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { razorpayPlanId: planId },
  });
  if (!plan) {
    logger.warn('subscription.activated: plan not found', planId);
    return;
  }

  // Get userId from notes (we passed it when creating subscription)
  const notes = subscription.notes || {};
  const userId = notes.user_id;
  if (!userId) {
    logger.warn('subscription.activated: no user_id in notes');
    return;
  }

  const currentStart = subscription.current_start
    ? new Date(subscription.current_start * 1000)
    : new Date();
  const currentEnd = subscription.current_end
    ? new Date(subscription.current_end * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.userSubscription.upsert({
      where: {
        userId_planId: { userId, planId: plan.id },
      },
      create: {
        userId,
        planId: plan.id,
        status: 'ACTIVE',
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        externalId: razorpaySubId,
      },
      update: {
        status: 'ACTIVE',
        currentPeriodStart: currentStart,
        currentPeriodEnd: currentEnd,
        externalId: razorpaySubId,
        cancelledAt: null,
        cancelAtPeriodEnd: false,
      },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        plan: mapPlanSlugToUserPlan(plan.slug),
        planExpiresAt: currentEnd,
      },
    }),
  ]);

  const { trackEvent } = await import('../services/growthAnalyticsService.js');
  trackEvent('subscription_started', userId, { planSlug: plan.slug }).catch(() => {});

  logger.info('subscription.activated', { userId, planId: plan.slug, razorpaySubId });
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
    await prisma.user.update({
      where: { id: userId },
      data: otherActive
        ? { plan: mapPlanSlugToUserPlan(otherActive.plan.slug), planExpiresAt: otherActive.currentPeriodEnd }
        : { plan: 'FREE', planExpiresAt: null },
    });
  }

  const { trackEvent } = await import('../services/growthAnalyticsService.js');
  for (const userId of userIds) {
    trackEvent('subscription_cancelled', userId, {}).catch(() => {});
  }

  logger.info('subscription.cancelled', { razorpaySubId });
}
