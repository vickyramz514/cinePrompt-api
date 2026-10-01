/**
 * Admin marketing email endpoints + public unsubscribe endpoints
 */

import { z } from 'zod';
import config from '../config/index.js';
import * as marketingEmailService from '../services/marketingEmailService.js';
import { logAdminAction } from '../services/adminAuditService.js';
import { verifyUnsubscribeToken } from '../utils/unsubscribeToken.js';
import { ValidationError } from '../utils/errors.js';

const contentSchema = z.object({
  subject: z.string().trim().min(3).max(150),
  preheader: z.string().trim().max(200).optional().default(''),
  headline: z.string().trim().min(3).max(150),
  body: z.string().trim().min(10).max(5000),
  ctaLabel: z.string().trim().min(2).max(40),
  ctaUrl: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), 'CTA URL must be http(s)'),
  showPlans: z.boolean().optional().default(true),
});

const testSchema = z.object({
  content: contentSchema,
  to: z.string().trim().email().optional(),
});

const campaignSchema = z.object({
  content: contentSchema,
  audience: z.enum(marketingEmailService.AUDIENCES),
  confirmCount: z.number().int().nonnegative(),
});

const parse = (schema, body) => {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError(
      'Validation failed',
      parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message }))
    );
  }
  return parsed.data;
};

export const getAudience = async (req, res, next) => {
  try {
    const data = await marketingEmailService.getAudienceCounts();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const preview = async (req, res, next) => {
  try {
    const content = parse(contentSchema, req.body);
    const data = await marketingEmailService.previewEmail(content, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const sendTest = async (req, res, next) => {
  try {
    const { content, to } = parse(testSchema, req.body);
    const data = await marketingEmailService.sendTestEmail(content, req.user, to);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const createCampaign = async (req, res, next) => {
  try {
    const { content, audience, confirmCount } = parse(campaignSchema, req.body);
    const counts = await marketingEmailService.getAudienceCounts();
    // Guards against sending to a much larger list than the admin confirmed in the UI
    if (confirmCount !== counts[audience]) {
      throw new ValidationError('Audience size changed. Refresh and confirm again.', [
        { path: 'confirmCount', message: `Expected ${counts[audience]}` },
      ]);
    }
    const campaign = await marketingEmailService.startCampaign({ content, audience, adminId: req.user.id });
    await logAdminAction(req.user.id, 'marketing_email_campaign', 'USER', null, {
      campaignId: campaign.id,
      audience,
      totalRecipients: campaign.totalRecipients,
      subject: content.subject,
    });
    res.status(202).json({ success: true, data: campaign });
  } catch (err) {
    next(err);
  }
};

export const listCampaigns = async (req, res, next) => {
  try {
    const data = await marketingEmailService.listCampaigns();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const unsubscribePage = (title, message) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · DataCaptain</title></head>
<body style="margin:0;background:#0a0a0f;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<main style="max-width:440px;padding:32px;text-align:center;">
<div style="font-size:20px;font-weight:700;margin-bottom:24px;">Data<span style="color:#f59e0b;">Captain</span></div>
<h1 style="font-size:22px;margin:0 0 12px;">${title}</h1>
<p style="color:rgba(255,255,255,0.7);line-height:1.6;margin:0 0 24px;">${message}</p>
<a href="${config.email.appUrl}" style="color:#f59e0b;text-decoration:none;">Go to DataCaptain &rarr;</a>
</main></body></html>`;

/** GET (link click) and POST (RFC 8058 one-click from Gmail/Yahoo) */
export const unsubscribe = async (req, res, next) => {
  try {
    const userId = req.query.u;
    const token = req.query.t;
    if (!verifyUnsubscribeToken(userId, token)) {
      res.status(400).type('html').send(unsubscribePage('Invalid link', 'This unsubscribe link is invalid or incomplete.'));
      return;
    }
    await marketingEmailService.unsubscribeUser(userId);
    if (req.method === 'POST') {
      res.status(200).json({ success: true });
      return;
    }
    res
      .status(200)
      .type('html')
      .send(
        unsubscribePage(
          "You're unsubscribed",
          "You won't receive marketing emails from DataCaptain anymore. Account and billing emails are not affected."
        )
      );
  } catch (err) {
    next(err);
  }
};
