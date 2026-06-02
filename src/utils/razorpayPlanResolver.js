/**
 * Resolve Razorpay plan IDs by runtime mode (test/live).
 * Current behavior: always uses LIVE mapping file.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let cache = null;

function inferMode() {
  // Product decision: always use LIVE plan mapping for checkout.
  // (If needed later, this can be reverted to key-based inference.)
  return 'live';
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

