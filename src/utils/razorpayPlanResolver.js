/**
 * Resolve Razorpay plan IDs by runtime mode (test/live).
 * Default behavior:
 * - rzp_test_* keys => test map
 * - rzp_live_* keys => live map
 * Optional override: RAZORPAY_PLAN_RESOLVER_MODE=test|live
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cache = null;

function inferMode() {
  const forced = process.env.RAZORPAY_PLAN_RESOLVER_MODE?.trim().toLowerCase();
  if (forced === 'test' || forced === 'live') return forced;

  if (config.razorpay.declaredMode === 'test' || config.razorpay.declaredMode === 'live') {
    return config.razorpay.declaredMode;
  }
  if (config.razorpay.mode === 'test' || config.razorpay.mode === 'live') {
    return config.razorpay.mode;
  }
  return config.isProduction ? 'live' : 'test';
}

function loadPlanMap() {
  if (cache) return cache;
  const mode = inferMode();
  const fileName = mode === 'live' ? 'razorpay-plans.live.json' : 'razorpay-plans.test.json';
  const filePath = resolve(__dirname, '../../scripts', fileName);
  let map = {};
  try {
    map = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    map = {};
  }
  cache = { mode, map };
  return cache;
}

export function resolvePlanId(planSlug, fallbackPlanId = null) {
  const slug = String(planSlug || '').toLowerCase().trim();
  const { mode, map } = loadPlanMap();
  const mapped = map?.[slug];
  return {
    mode,
    planId: mapped || fallbackPlanId || null,
  };
}

export function getRazorpayPlanResolverMode() {
  return inferMode();
}

