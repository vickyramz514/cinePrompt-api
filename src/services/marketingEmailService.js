/**
 * Marketing email campaigns — audience selection, preview, test send and throttled bulk send.
 * Only users who have not opted out of marketing (User.marketingOptOut) are ever emailed.
 */

import prisma from '../utils/prisma.js';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { sendMail, isEmailConfigured } from './email/mailer.js';
import { renderMarketingEmail } from './email/marketingTemplate.js';
import { buildUnsubscribeUrl } from '../utils/unsubscribeToken.js';

export const AUDIENCES = ['free', 'lapsed', 'all'];

const BATCH_SIZE = 200;
const MAX_CONSECUTIVE_FAILURES = 10;
// A campaign stuck in SENDING longer than this (e.g. server restarted) no longer blocks new sends
const STALE_SENDING_MS = 6 * 60 * 60 * 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const audienceWhere = (audience) => {
  const base = { isActive: true, marketingOptOut: false };
  const noActiveSub = { userSubscriptions: { none: { status: 'ACTIVE' } } };
  switch (audience) {
    case 'free':
      return { ...base, plan: 'FREE', ...noActiveSub };
    case 'lapsed':
      return {
        ...base,
        userSubscriptions: {
          none: { status: 'ACTIVE' },
          some: { status: { in: ['CANCELLED', 'EXPIRED', 'PAST_DUE'] } },
        },
      };
    case 'all':
      return base;
    default:
      throw new AppError(`Unknown audience: ${audience}`, 400, 'INVALID_AUDIENCE');
  }
};

export const getAudienceCounts = async () => {
  const [free, lapsed, all, optedOut] = await Promise.all([
    prisma.user.count({ where: audienceWhere('free') }),
    prisma.user.count({ where: audienceWhere('lapsed') }),
    prisma.user.count({ where: audienceWhere('all') }),
    prisma.user.count({ where: { marketingOptOut: true } }),
  ]);
  return { free, lapsed, all, optedOut, emailConfigured: isEmailConfigured() };
};

export const getPaidPlans = () =>
  prisma.subscriptionPlan.findMany({
    where: { isActive: true, adminOnly: false, priceCents: { gt: 0 } },
    orderBy: { sortOrder: 'asc' },
    take: 3,
    select: { name: true, slug: true, priceCents: true, billingCycle: true, features: true },
  });

const buildMessage = (user, content, plans, campaignTag) => {
  const unsubscribeUrl = buildUnsubscribeUrl(user.id);
  const rendered = renderMarketingEmail({ user, content, plans, unsubscribeUrl, campaignTag });
  return {
    to: user.email,
    ...rendered,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };
};

export const previewEmail = async (content, user) => {
  const plans = content.showPlans ? await getPaidPlans() : [];
  const { subject, html, text } = buildMessage(user, content, plans, 'preview');
  return { subject, html, text };
};

export const sendTestEmail = async (content, admin, to) => {
  const plans = content.showPlans ? await getPaidPlans() : [];
  const message = buildMessage({ ...admin, email: to || admin.email }, content, plans, 'test');
  await sendMail({ ...message, subject: `[TEST] ${message.subject}` });
  return { to: message.to };
};

const assertNoCampaignInFlight = async () => {
  const inFlight = await prisma.emailCampaign.findFirst({
    where: { status: 'SENDING', createdAt: { gt: new Date(Date.now() - STALE_SENDING_MS) } },
    select: { id: true },
  });
  if (inFlight) {
    throw new AppError('Another campaign is still sending. Wait for it to finish.', 409, 'CAMPAIGN_IN_PROGRESS');
  }
};

const runCampaign = async (campaign, content, audience) => {
  const plans = content.showPlans ? await getPaidPlans() : [];
  const tag = `dc-${campaign.id.slice(0, 8)}`;
  let cursor;
  let sent = 0;
  let failed = 0;
  let consecutiveFailures = 0;
  let lastError = null;

  try {
    for (;;) {
      const batch = await prisma.user.findMany({
        where: audienceWhere(audience),
        select: { id: true, email: true, name: true },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;

      for (const user of batch) {
        try {
          await sendMail(buildMessage(user, content, plans, tag));
          sent += 1;
          consecutiveFailures = 0;
        } catch (err) {
          failed += 1;
          consecutiveFailures += 1;
          lastError = err?.message?.slice(0, 500) || 'Unknown error';
          logger.warn('Marketing email failed', { campaignId: campaign.id, userId: user.id, message: lastError });
          if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
            throw new Error(`Aborted after ${MAX_CONSECUTIVE_FAILURES} consecutive failures: ${lastError}`);
          }
        }
        if (config.email.sendDelayMs > 0) await sleep(config.email.sendDelayMs);
      }

      cursor = batch[batch.length - 1].id;
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { sentCount: sent, failedCount: failed, lastError },
      });
    }

    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'COMPLETED', sentCount: sent, failedCount: failed, lastError, completedAt: new Date() },
    });
    logger.info('Marketing campaign completed', { campaignId: campaign.id, sent, failed });
  } catch (err) {
    await prisma.emailCampaign
      .update({
        where: { id: campaign.id },
        data: {
          status: 'FAILED',
          sentCount: sent,
          failedCount: failed,
          lastError: err?.message?.slice(0, 500),
          completedAt: new Date(),
        },
      })
      .catch(() => {});
    logger.error('Marketing campaign failed', { campaignId: campaign.id, message: err?.message });
  }
};

/** Creates the campaign record and sends in the background; returns immediately. */
export const startCampaign = async ({ content, audience, adminId }) => {
  if (!isEmailConfigured()) {
    throw new AppError('Email is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  await assertNoCampaignInFlight();

  const totalRecipients = await prisma.user.count({ where: audienceWhere(audience) });
  if (totalRecipients === 0) {
    throw new AppError('No recipients match this audience.', 400, 'EMPTY_AUDIENCE');
  }

  const campaign = await prisma.emailCampaign.create({
    data: { subject: content.subject, audience, content, totalRecipients, createdById: adminId },
  });

  setImmediate(() => {
    runCampaign(campaign, content, audience);
  });

  return campaign;
};

export const listCampaigns = (limit = 20) =>
  prisma.emailCampaign.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      subject: true,
      audience: true,
      status: true,
      totalRecipients: true,
      sentCount: true,
      failedCount: true,
      lastError: true,
      createdAt: true,
      completedAt: true,
    },
  });

export const unsubscribeUser = async (userId) => {
  const result = await prisma.user.updateMany({
    where: { id: userId, marketingOptOut: false },
    data: { marketingOptOut: true, marketingOptOutAt: new Date() },
  });
  return result.count > 0;
};

export const resubscribeUser = (userId) =>
  prisma.user.update({
    where: { id: userId },
    data: { marketingOptOut: false, marketingOptOutAt: null },
    select: { marketingOptOut: true },
  });
