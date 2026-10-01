/**
 * Marketing email template (table-based HTML for broad client support + plain-text part).
 */

import config from '../../config/index.js';

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const firstName = (name) => (String(name || '').trim().split(/\s+/)[0] || 'there');

export const personalize = (text, user) => String(text ?? '').replace(/\{\{\s*name\s*\}\}/gi, firstName(user?.name));

export const withUtm = (url, campaignTag) => {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', 'email');
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'marketing');
    if (campaignTag && !u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaignTag);
    return u.toString();
  } catch {
    return url;
  }
};

const formatPrice = (plan) => {
  const rupees = (plan.priceCents / 100).toLocaleString('en-IN');
  const cycle = plan.billingCycle === 'yearly' ? 'yr' : 'mo';
  return `₹${rupees}/${cycle}`;
};

const paragraphs = (body) =>
  String(body ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

const renderPlansHtml = (plans, ctaUrl) => {
  if (!plans?.length) return '';
  const cells = plans
    .map((plan) => {
      const features = (Array.isArray(plan.features) ? plan.features : [])
        .slice(0, 4)
        .map((f) => `<li style="margin:0 0 6px;">${escapeHtml(f)}</li>`)
        .join('');
      return `
        <td valign="top" style="padding:8px;width:${Math.floor(100 / plans.length)}%;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e4e4e7;border-radius:10px;">
            <tr><td style="padding:18px;">
              <div style="font-size:15px;font-weight:600;color:#18181b;">${escapeHtml(plan.name)}</div>
              <div style="font-size:22px;font-weight:700;color:#18181b;margin:6px 0 10px;">${escapeHtml(formatPrice(plan))}</div>
              <ul style="padding-left:18px;margin:0 0 14px;font-size:13px;color:#52525b;line-height:1.5;">${features}</ul>
              <a href="${escapeHtml(ctaUrl)}" style="font-size:13px;font-weight:600;color:#d97706;text-decoration:none;">Choose ${escapeHtml(plan.name)} &rarr;</a>
            </td></tr>
          </table>
        </td>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 16px;"><tr>${cells}</tr></table>`;
};

const renderPlansText = (plans) =>
  (plans || [])
    .map((plan) => {
      const features = (Array.isArray(plan.features) ? plan.features : []).slice(0, 4).join(', ');
      return `- ${plan.name} (${formatPrice(plan)}): ${features}`;
    })
    .join('\n');

/**
 * @param {{
 *   user: { name?: string },
 *   content: { subject: string, preheader?: string, headline: string, body: string, ctaLabel: string, ctaUrl: string, showPlans?: boolean },
 *   plans?: Array<{ name: string, priceCents: number, billingCycle?: string|null, features?: unknown }>,
 *   unsubscribeUrl: string,
 *   campaignTag?: string,
 * }} params
 */
export const renderMarketingEmail = ({ user, content, plans = [], unsubscribeUrl, campaignTag }) => {
  const subject = personalize(content.subject, user);
  const headline = personalize(content.headline, user);
  const preheader = personalize(content.preheader || '', user);
  const bodyParas = paragraphs(personalize(content.body, user));
  const ctaUrl = withUtm(content.ctaUrl, campaignTag);
  const visiblePlans = content.showPlans ? plans : [];
  const address = config.email.postalAddress;

  const bodyHtml = bodyParas
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`
    )
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0a0a0f;padding:20px 28px;">
        <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:0.2px;">Data<span style="color:#f59e0b;">Captain</span></span>
      </td></tr>
      <tr><td style="padding:32px 28px 8px;">
        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;color:#18181b;">${escapeHtml(headline)}</h1>
        ${bodyHtml}
        ${renderPlansHtml(visiblePlans, ctaUrl)}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 28px;">
          <tr><td style="background:#f59e0b;border-radius:8px;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:#0a0a0f;text-decoration:none;">${escapeHtml(content.ctaLabel)}</a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;border-top:1px solid #e4e4e7;font-size:12px;line-height:1.6;color:#71717a;">
        You're receiving this because you have a DataCaptain account.
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Unsubscribe from marketing emails</a>.
        ${address ? `<br>${escapeHtml(address)}` : ''}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

  const plansText = visiblePlans.length ? `\n\nPlans:\n${renderPlansText(visiblePlans)}` : '';
  const text = [
    headline,
    '',
    bodyParas.join('\n\n'),
    plansText.trim() ? plansText.trim() : null,
    '',
    `${content.ctaLabel}: ${ctaUrl}`,
    '',
    '---',
    "You're receiving this because you have a DataCaptain account.",
    `Unsubscribe: ${unsubscribeUrl}`,
    address || null,
  ]
    .filter((line) => line !== null)
    .join('\n');

  return { subject, html, text };
};
