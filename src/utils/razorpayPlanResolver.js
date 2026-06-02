/**
 * Resolve Razorpay plan IDs by runtime mode (test/live).
 * Local with rzp_test_* keys => scripts/razorpay-plans.test.json
 * Deployment with rzp_live_* keys => scripts/razorpay-plans.live.json
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cache = null;

function inferMode() {
  if (config.razorpay.declaredMode) return config.razorpay.declaredMode;
  const fromKey = config.razorpay.mode;
  if (fromKey === 'test' || fromKey === 'live') return fromKey;
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

