/**
 * Startup hints for Razorpay test vs live configuration.
 */

import config from '../config/index.js';
import { logger } from './logger.js';

export function logRazorpayStartupHints() {
  const r = config.razorpay;
  if (!r.keyId) {
    logger.warn('Razorpay: RAZORPAY_KEY_ID not set — subscription checkout will fail until keys are configured');
    return;
  }

  logger.info('Razorpay', {
    inferredMode: r.mode,
    ...(r.declaredMode ? { RAZORPAY_MODE: r.declaredMode } : {}),
  });

  logger.info('Razorpay plan resolver mode: live (using scripts/razorpay-plans.live.json)');

  if (r.declaredMode && r.mode !== 'unknown' && r.declaredMode !== r.mode) {
    logger.warn(
      `Razorpay: RAZORPAY_MODE=${r.declaredMode} does not match key id (inferred ${r.mode} from RAZORPAY_KEY_ID). Fix env so plan IDs and webhook match the same mode.`
    );
  }

  if (config.isProduction && r.mode === 'test') {
    logger.warn(
      'Razorpay: NODE_ENV=production but keys are TEST (rzp_test_*) — only sandbox payments; use rzp_live_* + live Dashboard plans + live webhook on this host for real settlements.'
    );
  }

  if (!config.isProduction && r.mode === 'live') {
    logger.warn(
      'Razorpay: Using LIVE keys in a non-production NODE_ENV — real money. Prefer rzp_test_* for local/staging.'
    );
  }

  if (r.mode === 'unknown') {
    logger.warn(
      'Razorpay: RAZORPAY_KEY_ID does not start with rzp_test_ or rzp_live_ — verify key format from dashboard.razorpay.com'
    );
  }
}
