/**
 * Investor Metrics Service - VC-grade KPIs
 */

import prisma from '../utils/prisma.js';

export const getInvestorMetrics = async () => {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    activeSubscriptions,
    plans,
    paymentsThisMonth,
    paymentsLastMonth,
    totalRevenue,
    totalUsers,
    cancelledThisMonth,
    balance,
  ] = await Promise.all([
    prisma.userSubscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscriptionPlan.findMany({ where: { isActive: true } }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED', createdAt: { gte: lastMonthStart, lt: monthStart } },
      _sum: { amountCents: true },
    }),
    prisma.payment.aggregate({
      where: { status: 'COMPLETED' },
      _sum: { amountCents: true },
    }),
    prisma.user.count(),
    prisma.userSubscription.count({
      where: { status: 'CANCELLED', cancelledAt: { gte: monthStart } },
    }),
    Promise.resolve(0),
  ]);

  const avgPlanPrice =
    plans.length > 0
      ? plans.reduce((s, p) => s + p.priceCents, 0) / plans.length / 100
      : 0;
  const mrr = (activeSubscriptions * avgPlanPrice) / 100;
  const arr = mrr * 12;
  const arpu = totalUsers > 0 ? mrr / totalUsers : 0;
  const totalSubs = activeSubscriptions + cancelledThisMonth;
  const churnRate = totalSubs > 0 ? (cancelledThisMonth / totalSubs) * 100 : 0;
  const ltv = churnRate > 0 ? arpu / (churnRate / 100) : arpu * 12;

  const revenueThisMonth = (paymentsThisMonth._sum.amountCents ?? 0) / 100;
  const revenueLastMonth = (paymentsLastMonth._sum.amountCents ?? 0) / 100;
  const growthRate =
    revenueLastMonth > 0
      ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
      : revenueThisMonth > 0 ? 100 : 0;

  const apiCost = 0;
  const totalRevenueCents = totalRevenue._sum?.amountCents ?? 0;
  const totalRevenueInr = totalRevenueCents / 100;
  const profitMargin =
    totalRevenueInr > 0 ? ((totalRevenueInr - apiCost * 83) / totalRevenueInr) * 100 : 0;

  const burnRate = Math.max(0, apiCost * 83 - revenueThisMonth);
  const runwayMonths = burnRate > 0 && balance >= 0 ? balance / burnRate : 0;

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(arr * 100) / 100,
    arpu: Math.round(arpu * 100) / 100,
    churnRate: Math.round(churnRate * 100) / 100,
    growthRate: Math.round(growthRate * 100) / 100,
    ltv: Math.round(ltv * 100) / 100,
    profitMargin: Math.round(profitMargin * 100) / 100,
    burnRate: Math.round(burnRate * 100) / 100,
    runwayMonths: Math.round(runwayMonths * 100) / 100,
    activeSubscriptions,
    totalUsers,
    totalRevenue: totalRevenueInr,
    revenueThisMonth,
    apiCostThisMonth: apiCost,
  };
};
