/**
 * Admin Dashboard & Management APIs
 */

import prisma from '../utils/prisma.js';
import { adminCreditAdjustment, getBalance } from '../services/creditService.js';
import { logAdminAction } from '../services/adminAuditService.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
import {
  prismaUserPlanToSlug,
  syncApiUserPlanByEmail,
} from '../utils/syncApiUserPlan.js';
import { getApiUsageCounts, getDailyApiUsage } from '../utils/apiUsageStats.js';
import { z } from 'zod';

const creditSchema = z.object({ amount: z.number().int().min(-10000).max(10000) });
const planOverrideSchema = z.object({ plan: z.enum(['FREE', 'STARTER', 'CREATOR', 'PRO', 'ULTRA']) });

/**
 * GET /api/admin/dashboard
 */
export const getDashboard = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsers, payments, activeSubscriptions, apiUsage] = await Promise.all([
      prisma.user.count(),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amountCents: true },
      }),
      prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
      getApiUsageCounts(today),
    ]);

    const totalRevenue = payments._sum.amountCents ?? 0;

    res.json({
      success: true,
      data: {
        totalUsers,
        totalApiRequests: apiUsage.total,
        todayApiRequests: apiUsage.today,
        totalRevenue,
        activeSubscriptions,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/dashboard/charts
 */
export const getDashboardCharts = async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days || '30', 10), 90);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const [dailyApiRequests, revenueByDate] = await Promise.all([
      getDailyApiUsage(start),
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COALESCE(SUM("amountCents"), 0)::int as cents
        FROM "Payment"
        WHERE "createdAt" >= ${start} AND status = 'COMPLETED'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    res.json({
      success: true,
      data: {
        dailyApiRequests,
        dailyRevenue: revenueByDate,
        days,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users
 */
export const getUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const search = (req.query.search || '').trim();
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { name: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          plan: true,
          credits: true,
          role: true,
          isActive: true,
          createdAt: true,
          wallet: { select: { balance: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithBalance = users.map((u) => ({
      ...u,
      credits: u.wallet?.balance ?? u.credits,
      wallet: undefined,
    }));

    res.json({
      success: true,
      data: {
        users: usersWithBalance,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/users/:id
 */
export const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        wallet: true,
        _count: {
          select: { payments: true, userSubscriptions: true },
        },
      },
    });
    if (!user) throw new NotFoundError('User not found');
    res.json({
      success: true,
      data: {
        ...user,
        credits: user.wallet?.balance ?? user.credits,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/users/:id/credit
 */
export const updateUserCredit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = creditSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid amount', parsed.error.errors);

    const targetUser = await prisma.user.findUnique({ where: { id } });
    if (!targetUser) throw new NotFoundError('User not found');

    const { amount } = parsed.data;
    const balance = await getBalance(id);

    if (amount === 0) {
      return res.json({ success: true, data: { credits: balance, delta: 0 } });
    }

    if (amount < 0 && balance < Math.abs(amount)) {
      throw new ValidationError(`Insufficient balance. User has ${balance} credits.`);
    }

    await adminCreditAdjustment(id, amount, req.user.id);
    const newBalance = await getBalance(id);
    await logAdminAction(req.user.id, 'credit_update', 'CREDIT', id, {
      amount,
      previousBalance: balance,
      newBalance,
    });

    res.json({
      success: true,
      data: { credits: newBalance, delta: amount },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/users/:id/block
 */
export const blockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) throw new ForbiddenError('Cannot block yourself');

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    if (!user.isActive) {
      return res.json({ success: true, data: { message: 'User already blocked' } });
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    await logAdminAction(req.user.id, 'block_user', 'USER', id, { email: user.email });

    res.json({ success: true, data: { message: 'User blocked' } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/users/:id/unblock
 */
export const unblockUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');

    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    await logAdminAction(req.user.id, 'unblock_user', 'USER', id, { email: user.email });

    res.json({ success: true, data: { message: 'User unblocked' } });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/users/:id/plan-override
 */
export const planOverride = async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsed = planOverrideSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid plan', parsed.error.errors);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found');

    const oldPlan = user.plan;
    await prisma.user.update({
      where: { id },
      data: { plan: parsed.data.plan, planExpiresAt: null },
    });

    if (user.email) {
      await syncApiUserPlanByEmail(
        user.email,
        prismaUserPlanToSlug(parsed.data.plan)
      ).catch(() => {});
    }

    await logAdminAction(req.user.id, 'plan_override', 'USER', id, {
      oldPlan,
      newPlan: parsed.data.plan,
    });

    res.json({ success: true, data: { plan: parsed.data.plan } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/payments
 */
export const getPayments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.payment.count(),
    ]);

    res.json({
      success: true,
      data: {
        payments,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/subscriptions
 */
export const getSubscriptions = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const [subscriptions, total] = await Promise.all([
      prisma.userSubscription.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          plan: { select: { id: true, name: true, slug: true, priceCents: true } },
        },
      }),
      prisma.userSubscription.count(),
    ]);

    res.json({
      success: true,
      data: {
        subscriptions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};
