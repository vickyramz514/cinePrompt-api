/**
 * Razorpay service - Subscriptions API
 * Backend-only: Frontend never calls Razorpay directly
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';

let razorpay = null;

/** Razorpay Node SDK puts API details on `err.error` (description, code, field). */
function razorpayErrorMessage(err) {
  const body = err?.error;
  if (typeof body === 'string') return body;
  if (body?.description) return body.description;
  if (Array.isArray(body)) {
    const parts = body.map((x) => x?.description || x?.field).filter(Boolean);
    if (parts.length) return parts.join('; ');
  }
  if (err?.description) return err.description;
  return err?.message || null;
}

const getRazorpay = () => {
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new Error('Razorpay credentials not configured');
  }
  if (!razorpay) {
    razorpay = new Razorpay({
      key_id: config.razorpay.keyId,
      key_secret: config.razorpay.keySecret,
    });
  }
  return razorpay;
};

/**
 * Create a Razorpay subscription for a plan
 * @param {string} planId - Razorpay plan ID (plan_xxx)
 * @param {string} userId - Our user ID (for notes)
 * @param {string|null} [customerEmail] - For notify_info when Razorpay sends subscription emails
 * @returns {Promise<{subscriptionId, shortUrl}>}
 */
export const createSubscription = async (planId, userId, customerEmail = null) => {
  const normalizedPlanId = typeof planId === 'string' ? planId.trim() : planId;
  if (!normalizedPlanId) {
    throw new AppError('Subscription plan is not linked to Razorpay', 400, 'PLAN_NOT_CONFIGURED');
  }

  try {
    const rzp = getRazorpay();
    const nowSec = Math.floor(Date.now() / 1000);
    /** Authorization window for hosted checkout (30 days). */
    const expireBy = nowSec + 30 * 24 * 60 * 60;

    const payload = {
      plan_id: normalizedPlanId,
      total_count: 12, // 12 months; use 999 for indefinite
      quantity: 1,
      notes: {
        user_id: userId,
      },
      expire_by: expireBy,
    };

    if (customerEmail) {
      payload.customer_notify = 1;
      payload.notify_info = { notify_email: customerEmail };
    } else {
      // With customer_notify=1 and no notify_info, Razorpay may reject the request.
      payload.customer_notify = 0;
    }

    const subscription = await rzp.subscriptions.create(payload);
    return {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      status: subscription.status,
    };
  } catch (err) {
    const rzpMsg = razorpayErrorMessage(err);
    logger.error('Razorpay createSubscription failed', {
      planId: normalizedPlanId,
      sdkMessage: err.message,
      rzpMessage: rzpMsg,
      statusCode: err.statusCode,
      rzpError: err.error,
    });
    const msg =
      rzpMsg ||
      (err.statusCode === 401 ? 'Invalid Razorpay credentials' : 'Payment provider error');
    throw new AppError(msg, 502, 'PAYMENT_PROVIDER_ERROR');
  }
};

/**
 * Cancel a Razorpay subscription
 * @param {string} subscriptionId - Razorpay sub_xxx
 */
export const cancelSubscription = async (subscriptionId) => {
  const rzp = getRazorpay();
  await rzp.subscriptions.cancel(subscriptionId);
};

/**
 * Fetch subscription details from Razorpay
 */
export const fetchSubscription = async (subscriptionId) => {
  const rzp = getRazorpay();
  return rzp.subscriptions.fetch(subscriptionId);
};

/**
 * Verify webhook signature
 * @param {string} body - Raw request body (string)
 * @param {string} signature - x-razorpay-signature header
 * @returns {boolean}
 */
export const verifyWebhookSignature = (body, signature) => {
  const secret = config.razorpay.webhookSecret;
  if (!secret) {
    logger.warn('Razorpay webhook secret not configured');
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
};

/**
 * Create a Razorpay plan (for seeding - run once)
 * Amount in paise (INR: 499 = 49900)
 */
export const createPlan = async (name, amountPaise, interval = 1, period = 'monthly') => {
  const rzp = getRazorpay();
  const plan = await rzp.plans.create({
    period,
    interval,
    item: {
      name,
      amount: amountPaise,
      currency: 'INR',
      description: `${name} plan`,
    },
  });
  return plan.id;
};
