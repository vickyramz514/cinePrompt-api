/**
 * Analytics Dashboard APIs
 */

import prisma from '../utils/prisma.js';
import { ForbiddenError } from '../utils/errors.js';
import { getDailyApiUsage, getTopApiUsers } from '../utils/apiUsageStats.js';

const requireAdmin = (req) => {
  if (!req.user?.role || !['ADMIN', 'SUPER_ADMIN'].includes(req.user.role)) {
    throw new ForbiddenError('Admin access required');
  }
};

/**
 * GET /api/analytics/overview
 */
export const getOverview = async (req, res, next) => {
  try {
    requireAdmin(req);

    const [totalUsers, payments, apiUsage] = await Promise.all([
      prisma.user.count(),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amountCents: true },
      }),
      prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM api_usage`.catch(() => [{ count: 0 }]),
    ]);

    const revenueCents = payments._sum.amountCents ?? 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalApiRequests: apiUsage[0]?.count ?? 0,
        revenue: { cents: revenueCents, inr: revenueCents / 100 },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/usage-trends
 */
export const getUsageTrends = async (req, res, next) => {
  try {
    requireAdmin(req);

    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const byDate = await getDailyApiUsage(start);

    res.json({
      success: true,
      data: { byDate, days },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/api-cost
 * Kept for route compatibility — video provider costs removed.
 */
export const getApiCost = async (req, res, next) => {
  try {
    requireAdmin(req);
    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    res.json({
      success: true,
      data: { totalCostUsd: 0, byProvider: [], byDate: [], days },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/top-users
 */
export const getTopUsers = async (req, res, next) => {
  try {
    requireAdmin(req);

    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);

    const top = await getTopApiUsers(start, limit);

    res.json({
      success: true,
      data: {
        users: top.map((row) => ({
          email: row.email,
          requestCount: row.requests,
        })),
        days,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/analytics/profit-metrics
 */
export const getProfitMetrics = async (req, res, next) => {
  try {
    requireAdmin(req);

    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const revenueByDate = await prisma.$queryRaw`
      SELECT DATE("createdAt") as date, SUM("amountCents")::int as cents
      FROM "Payment"
      WHERE "createdAt" >= ${start} AND status = 'COMPLETED'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    const byDate = revenueByDate.map((row) => ({
      date: row.date,
      revenueCents: row.cents ?? 0,
      profitInr: (row.cents ?? 0) / 100,
    }));

    res.json({
      success: true,
      data: { byDate, days },
    });
  } catch (err) {
    next(err);
  }
};
