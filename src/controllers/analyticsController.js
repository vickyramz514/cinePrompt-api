/**
 * Analytics Dashboard APIs
 * Admin-only endpoints for business metrics
 */

import prisma from '../utils/prisma.js';
import { getDailyCost } from '../services/costService.js';
import { ForbiddenError } from '../utils/errors.js';

const requireAdmin = (req) => {
  if (!req.user?.role || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new ForbiddenError('Admin access required');
  }
};

/**
 * GET /api/analytics/overview
 * revenue, total cost, profit, total users, total jobs
 */
export const getOverview = async (req, res, next) => {
  try {
    requireAdmin(req);

    const [totalUsers, totalJobs, payments, costData] = await Promise.all([
      prisma.user.count(),
      prisma.videoJob.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amountCents: true },
      }),
      prisma.apiCostLog.aggregate({
        _sum: { cost: true },
      }),
    ]);

    const revenueCents = payments._sum.amountCents ?? 0;
    const revenueInr = revenueCents / 100;
    const totalCostUsd = costData._sum.cost ?? 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalJobs,
        revenue: { cents: revenueCents, inr: revenueInr },
        totalApiCostUsd: totalCostUsd,
        profitInr: revenueInr - totalCostUsd * 83, // Approx INR conversion
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/usage-trends
 * daily video jobs + seconds usage
 */
export const getUsageTrends = async (req, res, next) => {
  try {
    requireAdmin(req);

    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const byDate = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date,
             COUNT(*)::int as jobs,
             COALESCE(SUM("creditsUsed"), 0)::int as seconds
      FROM "VideoJob"
      WHERE "createdAt" >= ${start}
        AND status = 'COMPLETED'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    res.json({
      success: true,
      data: {
        byDate,
        days,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/api-cost
 * daily + monthly cost aggregation
 */
export const getApiCost = async (req, res, next) => {
  try {
    requireAdmin(req);

    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const { totalCost, byProvider, byDate } = await getDailyCost(days);

    res.json({
      success: true,
      data: {
        totalCostUsd: totalCost,
        byProvider,
        byDate,
        days,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/top-users
 * highest usage users
 */
export const getTopUsers = async (req, res, next) => {
  try {
    requireAdmin(req);

    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);

    const top = await prisma.$queryRaw`
      SELECT "userId", COUNT(*)::int as jobs, COALESCE(SUM("creditsUsed"), 0)::int as seconds
      FROM "VideoJob"
      WHERE "createdAt" >= ${start} AND status = 'COMPLETED'
      GROUP BY "userId"
      ORDER BY seconds DESC
      LIMIT ${limit}
    `;

    const userIds = top.map((t) => t.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true, plan: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const result = top.map((t) => ({
      userId: t.userId,
      user: userMap[t.userId],
      jobsCount: t.jobs,
      secondsUsed: t.seconds ?? 0,
    }));

    res.json({
      success: true,
      data: {
        users: result,
        days,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/profit-metrics
 * revenue - api cost trends
 */
export const getProfitMetrics = async (req, res, next) => {
  try {
    requireAdmin(req);

    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const [revenueByDate, costByDate] = await Promise.all([
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, SUM("amountCents")::int as cents
        FROM "Payment"
        WHERE "createdAt" >= ${start} AND status = 'COMPLETED'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, SUM(cost)::float as cost_usd
        FROM "ApiCostLog"
        WHERE "createdAt" >= ${start}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    const revenueMap = Object.fromEntries(
      revenueByDate.map((r) => [r.date?.toISOString?.()?.slice(0, 10) ?? r.date, r.cents])
    );
    const costMap = Object.fromEntries(
      costByDate.map((c) => [c.date?.toISOString?.()?.slice(0, 10) ?? c.date, c.cost_usd])
    );

    const allDates = new Set([
      ...Object.keys(revenueMap),
      ...Object.keys(costMap),
    ]);
    const byDate = [...allDates].sort().map((date) => ({
      date,
      revenueCents: revenueMap[date] ?? 0,
      costUsd: costMap[date] ?? 0,
      profitInr: (revenueMap[date] ?? 0) / 100 - (costMap[date] ?? 0) * 83,
    }));

    res.json({
      success: true,
      data: {
        byDate,
        days,
      },
    });
  } catch (err) {
    next(err);
  }
};
