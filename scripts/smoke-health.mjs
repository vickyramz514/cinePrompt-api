#!/usr/bin/env node
/**
 * Smoke-check API health (and optional status). Posts to UPTIME_WEBHOOK_URL on failure.
 *
 * Usage:
 *   API_BASE_URL=https://api.datacaptain.in node scripts/smoke-health.mjs
 *   HEALTH_URL=https://api.datacaptain.in/v1/health node scripts/smoke-health.mjs
 */

const base = (process.env.API_BASE_URL || process.env.PUBLIC_API_URL || 'http://localhost:4000').replace(
  /\/$/,
  ''
);
const healthUrl = process.env.HEALTH_URL || `${base.replace(/\/v1$/, '')}/v1/health`;
const statusUrl = process.env.STATUS_URL || `${base.replace(/\/v1$/, '')}/v1/status`;
const webhook = process.env.UPTIME_WEBHOOK_URL?.trim();
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || '15000');

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    const text = await res.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = { raw: text.slice(0, 200) };
    }
    return { ok: res.ok, status: res.status, body, url };
  } finally {
    clearTimeout(t);
  }
}

async function notify(message) {
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: message,
        content: message,
      }),
    });
  } catch (err) {
    console.error('Webhook notify failed:', err?.message || err);
  }
}

async function main() {
  const health = await fetchJson(healthUrl);
  console.log('health', health.status, health.body);

  if (!health.ok || health.body?.status !== 'ok') {
    const msg = `Data Captain API health FAILED: ${healthUrl} → HTTP ${health.status} ${JSON.stringify(health.body)}`;
    console.error(msg);
    await notify(msg);
    process.exit(1);
  }

  try {
    const status = await fetchJson(statusUrl);
    console.log('status', status.status, status.body?.status || status.body);
    if (status.ok && status.body?.status && status.body.status !== 'operational') {
      const msg = `Data Captain platform ${status.body.status}: ${statusUrl}`;
      console.warn(msg);
      await notify(msg);
      // Non-zero only if explicitly required
      if (process.env.SMOKE_REQUIRE_OPERATIONAL === 'true') process.exit(1);
    }
  } catch (err) {
    console.warn('status check skipped:', err?.message || err);
  }

  console.log('smoke-health OK');
}

main().catch(async (err) => {
  const msg = `Data Captain smoke-health crashed: ${err?.message || err}`;
  console.error(msg);
  await notify(msg);
  process.exit(1);
});
