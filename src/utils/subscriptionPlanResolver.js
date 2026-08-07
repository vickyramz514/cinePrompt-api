/**
 * Resolve SubscriptionPlan rows from Razorpay plan_* IDs.
 * Checkout uses scripts/razorpay-plans.{test,live}.json; DB razorpayPlanId may be stale or empty.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import prisma from './prisma.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsDir = resolve(__dirname, '../../scripts');

/** Prisma UserPlan enum from subscription slug */
export function mapPlanSlugToUserPlan(slug) {
  const m = {
    free: 'FREE',
    starter: 'STARTER',
    creator: 'CREATOR',
    pro: 'PRO',
    ultra: 'ULTRA',
    // ₹1 admin checkout plan — treat as Starter entitlements for testing
    'admin-test': 'STARTER',
  };
  return m[String(slug || '').toLowerCase()] || 'FREE';
}

function loadPlanMapFile(fileName) {
  try {
    return JSON.parse(readFileSync(resolve(scriptsDir, fileName), 'utf-8'));
  } catch {
    return {};
  }
}

/** Slug (starter, pro, …) for a Razorpay plan_* id from test + live JSON maps. */
export function resolvePlanSlugByRazorpayId(razorpayPlanId) {
  const id = String(razorpayPlanId || '').trim();
  if (!id) return null;

  for (const fileName of ['razorpay-plans.test.json', 'razorpay-plans.live.json']) {
    const map = loadPlanMapFile(fileName);
    for (const [slug, mappedId] of Object.entries(map)) {
      if (mappedId && mappedId === id) return slug;
    }
  }
  return null;
}

/**
 * Find DB SubscriptionPlan for a Razorpay plan id (JSON maps first, then DB column).
 */
export async function findSubscriptionPlanByRazorpayId(razorpayPlanId) {
  const id = String(razorpayPlanId || '').trim();
  if (!id) return null;

  const slug = resolvePlanSlugByRazorpayId(id);
  if (slug) {
    const bySlug = await prisma.subscriptionPlan.findFirst({
      where: { slug, isActive: true },
    });
    if (bySlug) return bySlug;
  }

  const byColumn = await prisma.subscriptionPlan.findFirst({
    where: { razorpayPlanId: id },
  });
  if (byColumn) return byColumn;

  logger.warn('No SubscriptionPlan for Razorpay plan id', {
    razorpayPlanId: id,
    resolvedSlug: slug,
  });
  return null;
}
