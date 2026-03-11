/**
 * Cost monitoring service
 * Logs API costs per job, aggregates daily/monthly metrics
 */

import prisma from '../utils/prisma.js';
import config from '../config/index.js';

/**
 * Log API cost for a completed job
 */
export const logApiCost = async (userId, jobId, provider, seconds, cost) => {
  return prisma.apiCostLog.create({
    data: {
      userId,
      jobId,
      provider,
      seconds,
      cost,
    },
  });
};

/**
 * Calculate cost for a job: seconds × provider_rate
 */
export const calculateJobCost = (seconds, provider = 'minimax') => {
  const rate =
    provider === 'minimax'
      ? config.apiCost.minimaxPerSecond
      : provider === 'runway'
        ? config.apiCost.runwayPerSecond
        : config.apiCost.replicatePerSecond;
  return seconds * rate;
};

/**
 * Aggregate daily cost
 */
export const getDailyCost = async (days = 30) => {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const logs = await prisma.apiCostLog.groupBy({
    by: ['provider'],
    where: { createdAt: { gte: start } },
    _sum: { cost: true },
    _count: { id: true },
  });

  const byDate = await prisma.$queryRaw`
    SELECT DATE("createdAt") as date, SUM(cost)::float as total
    FROM "ApiCostLog"
    WHERE "createdAt" >= ${start}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;

  const total = await prisma.apiCostLog.aggregate({
    where: { createdAt: { gte: start } },
    _sum: { cost: true },
  });

  return {
    totalCost: total._sum.cost ?? 0,
    byProvider: logs.map((l) => ({ provider: l.provider, cost: l._sum.cost ?? 0, count: l._count.id })),
    byDate: byDate,
  };
};
