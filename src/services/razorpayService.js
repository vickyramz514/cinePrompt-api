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
 * @returns {Promise<{subscriptionId, shortUrl}>}
 */
export const createSubscription = async (planId, userId) => {
  try {
    const rzp = getRazorpay();
    const subscription = await rzp.subscriptions.create({
      plan_id: planId,
      total_count: 12, // 12 months; use 999 for indefinite
      quantity: 1,
      customer_notify: 1,
      notes: {
        user_id: userId,
      },
    });
    return {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      status: subscription.status,
    };
  } catch (err) {
    logger.error('Razorpay createSubscription failed', {
      planId,
      error: err.message,
      statusCode: err.statusCode,
      description: err.description,
    });
    const msg =
      err.description ||
      err.message ||
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
