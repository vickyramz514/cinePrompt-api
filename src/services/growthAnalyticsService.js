/**
 * Growth Analytics Service - funnel, retention, churn
 */

import prisma from '../utils/prisma.js';

const EVENT_TYPES = [
  'signup',
  'login',
  'video_created',
  'payment_done',
  'subscription_started',
  'subscription_cancelled',
  'referral_used',
];

export const trackEvent = async (eventType, userId = null, meta = {}) => {
  if (!EVENT_TYPES.includes(eventType)) return;
  await prisma.growthEvent.create({
    data: { userId, eventType, meta },
  }).catch(() => {});
};

export const getGrowthOverview = async (days = 30) => {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const [
    dailySignups,
    dailyActives,
    totalUsers,
    totalPaidUsers,
    retentionData,
    churnData,
    funnelData,
  ] = await Promise.all([
    prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(*)::int as count
      FROM "User"
      WHERE "createdAt" >= ${start}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
    prisma.$queryRaw`
      SELECT DATE("createdAt") as date, COUNT(DISTINCT "userId")::int as count
      FROM "GrowthEvent"
      WHERE "createdAt" >= ${start} AND "eventType" = 'login'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,
    prisma.user.count(),
    prisma.payment.count({ where: { status: 'COMPLETED' } }),
    getRetention(start, days),
    getChurn(start, days),
    getFunnelConversion(start, days),
  ]);

  return {
    dailySignups,
    dailyActives,
    totalUsers,
    totalPaidUsers,
    retention: retentionData,
    churn: churnData,
    funnel: funnelData,
    days,
  };
};

async function getRetention(start, days) {
  const cohort = await prisma.$queryRaw`
    SELECT DATE("createdAt") as cohort_date, COUNT(*)::int as signups
    FROM "User"
    WHERE "createdAt" >= ${start}
    GROUP BY DATE("createdAt")
    ORDER BY cohort_date ASC
  `;
  return { cohorts: cohort, summary: {} };
}

async function getChurn(start, days) {
  const [cancelled, total] = await Promise.all([
    prisma.userSubscription.count({
      where: { status: 'CANCELLED', cancelledAt: { gte: start } },
    }),
    prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
  ]);
  const churnRate = total > 0 ? (cancelled / (total + cancelled)) * 100 : 0;
  return { cancelled, total, churnRate };
}

async function getFunnelConversion(start, days) {
  const [signups, firstVideo, subscriptions] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: start } } }),
    prisma.growthEvent.count({
      where: { eventType: 'video_created', createdAt: { gte: start } },
    }),
    prisma.userSubscription.count({
      where: { status: 'ACTIVE', createdAt: { gte: start } },
    }),
  ]);

  const signupToVideo = signups > 0 ? ((firstVideo / signups) * 100).toFixed(1) : 0;
  const videoToSub = firstVideo > 0 ? ((subscriptions / firstVideo) * 100).toFixed(1) : 0;

  return {
    signups,
    firstVideo,
    subscriptions,
    signupToVideo: parseFloat(signupToVideo),
    videoToSub: parseFloat(videoToSub),
  };
}

export const getFunnel = async (days = 30) => {
  const overview = await getGrowthOverview(days);
  return overview.funnel;
};
