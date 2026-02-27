/**
 * Admin Dashboard & Management APIs
 * All routes protected by authenticate + adminOnly
 */

import prisma from '../utils/prisma.js';
import { adminCreditAdjustment, getBalance } from '../services/creditService.js';
import { logAdminAction } from '../services/adminAuditService.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../utils/errors.js';
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

    const [
      totalUsers,
      totalJobs,
      todayJobs,
      payments,
      costData,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.videoJob.count({ where: { status: 'COMPLETED' } }),
      prisma.videoJob.count({
        where: { status: 'COMPLETED', createdAt: { gte: today } },
      }),
      prisma.payment.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { amountCents: true },
      }),
      prisma.apiCostLog.aggregate({ _sum: { cost: true } }).catch(() => ({ _sum: { cost: null } })),
      prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
    ]);

    const totalRevenue = payments._sum.amountCents ?? 0;
    const totalApiCost = costData._sum.cost ?? 0;
    const totalProfit = totalRevenue / 100 - totalApiCost * 83; // Approx INR

    res.json({
      success: true,
      data: {
        totalUsers,
        totalJobs,
        todayJobs,
        totalRevenue,
        totalApiCost,
        totalProfit,
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

    const [jobsByDate, revenueByDate, costByDate] = await Promise.all([
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COUNT(*)::int as jobs
        FROM "VideoJob"
        WHERE "createdAt" >= ${start} AND status = 'COMPLETED'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COALESCE(SUM("amountCents"), 0)::int as cents
        FROM "Payment"
        WHERE "createdAt" >= ${start} AND status = 'COMPLETED'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
      prisma.$queryRaw`
        SELECT DATE("createdAt") as date, COALESCE(SUM(cost), 0)::float as cost_usd
        FROM "ApiCostLog"
        WHERE "createdAt" >= ${start}
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `.catch(() => []),
    ]);

    res.json({
      success: true,
      data: {
        dailyJobs: jobsByDate,
        dailyRevenue: revenueByDate,
        dailyCost: costByDate,
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
          select: { videoJobs: true, payments: true, userSubscriptions: true },
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
 * GET /api/admin/jobs
 */
export const getJobs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const status = req.query.status;
    const skip = (page - 1) * limit;

    const where = status ? { status } : {};

    const [jobs, total] = await Promise.all([
      prisma.videoJob.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.videoJob.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        jobs,
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
 * GET /api/admin/jobs/:id
 */
export const getJobById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await prisma.videoJob.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        steps: true,
      },
    });
    if (!job) throw new NotFoundError('Job not found');
    res.json({ success: true, data: job });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/jobs/:id/cancel
 */
export const cancelJob = async (req, res, next) => {
  try {
    const { id } = req.params;
    const job = await prisma.videoJob.findUnique({ where: { id } });
    if (!job) throw new NotFoundError('Job not found');

    if (!['PENDING', 'QUEUED', 'PROCESSING'].includes(job.status)) {
      throw new ValidationError(`Cannot cancel job with status ${job.status}`);
    }

    await prisma.videoJob.update({
      where: { id },
      data: { status: 'CANCELLED', error: 'Cancelled by admin' },
    });

    const { releaseCreditLock } = await import('../middlewares/creditGuard.js');
    await releaseCreditLock(id);

    await logAdminAction(req.user.id, 'cancel_job', 'JOB', id, {
      userId: job.userId,
      previousStatus: job.status,
    });

    res.json({ success: true, data: { message: 'Job cancelled' } });
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

/**
 * GET /api/admin/abuse-logs
 */
export const getAbuseLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const type = req.query.type;
    const skip = (page - 1) * limit;

    const where = type ? { type } : {};

    const [logs, total] = await Promise.all([
      prisma.abuseLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.abuseLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    const logsWithUser = logs.map((l) => ({
      ...l,
      user: userMap[l.userId] || null,
    }));

    res.json({
      success: true,
      data: {
        logs: logsWithUser,
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
