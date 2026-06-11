/**
 * Shared CORS origin rules for server.js preflight and config.cors.
 */

export function parseCorsOriginList() {
  return process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
}

export function isVercelPreviewOrigin(origin) {
  return Boolean(origin && (origin.endsWith('.vercel.app') || origin.includes('.vercel.app')));
}

/** Production app host(s) for DataCaptain */
export function isDatacaptainAppOrigin(origin) {
  if (!origin) return false;
  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'http:' && protocol !== 'https:') return false;
    return hostname === 'datacaptain.in' || hostname === 'www.datacaptain.in' || hostname.endsWith('.datacaptain.in');
  } catch {
    return false;
  }
}

export function isOriginAllowed(origin, { nodeEnv = process.env.NODE_ENV } = {}) {
  if (!origin) return true;

  const envOrigins = parseCorsOriginList();
  const allowed = envOrigins.length > 0 ? envOrigins : ['http://localhost:3000'];
  const allowAllInProd = nodeEnv === 'production' && envOrigins.length === 0;

  return (
    allowAllInProd ||
    allowed.includes(origin) ||
    (nodeEnv === 'production' && isVercelPreviewOrigin(origin)) ||
    (nodeEnv === 'production' && isDatacaptainAppOrigin(origin))
  );
}
