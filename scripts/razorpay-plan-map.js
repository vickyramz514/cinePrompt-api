import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function inferModeFromKeyId(keyId) {
  if (!keyId) return null;
  if (keyId.startsWith('rzp_test_')) return 'test';
  if (keyId.startsWith('rzp_live_')) return 'live';
  return null;
}

export function resolveRazorpayMode() {
  const explicit = process.env.RAZORPAY_PLAN_MAP_MODE?.trim().toLowerCase();
  if (explicit === 'test' || explicit === 'live') return explicit;
  const fromKey = inferModeFromKeyId(process.env.RAZORPAY_KEY_ID);
  return fromKey || 'test';
}

export function loadPlanMap(mode = resolveRazorpayMode()) {
  const file =
    mode === 'live'
      ? resolve(__dirname, './razorpay-plans.live.json')
      : resolve(__dirname, './razorpay-plans.test.json');
  const parsed = JSON.parse(readFileSync(file, 'utf-8'));
  return { mode, file, map: parsed };
}
