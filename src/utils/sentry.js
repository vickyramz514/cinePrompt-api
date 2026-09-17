/**
 * Optional Sentry for the API. No-ops unless SENTRY_DSN is set.
 */

let Sentry = null;
let initialized = false;

export async function initSentry() {
  if (initialized) return Sentry;
  initialized = true;
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return null;

  try {
    const mod = await import('@sentry/node');
    Sentry = mod;
    mod.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      enabled: true,
    });
    return mod;
  } catch (err) {
    console.warn('Sentry init failed:', err?.message || err);
    return null;
  }
}

export function captureException(err, context) {
  if (!Sentry) return;
  try {
    if (context) {
      Sentry.withScope((scope) => {
        Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
  } catch {
    /* ignore */
  }
}

export function getSentry() {
  return Sentry;
}
