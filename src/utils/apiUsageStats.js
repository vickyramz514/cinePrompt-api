/**
 * DataCaptain API usage stats from Sequelize api_usage table (same Postgres DB).
 */

import prisma from './prisma.js';

export async function getApiUsageCounts(since = null) {
  try {
    if (since) {
      const rows = await prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE created_at >= ${since})::int AS today
        FROM api_usage
      `;
      return {
        total: rows[0]?.total ?? 0,
        today: rows[0]?.today ?? 0,
      };
    }

    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS total FROM api_usage
    `;
    return { total: rows[0]?.total ?? 0, today: 0 };
  } catch {
    return { total: 0, today: 0 };
  }
}

export async function getDailyApiUsage(start) {
  try {
    return await prisma.$queryRaw`
      SELECT DATE(created_at) AS date, COUNT(*)::int AS requests
      FROM api_usage
      WHERE created_at >= ${start}
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;
  } catch {
    return [];
  }
}

export async function getTopApiUsers(start, limit = 20) {
  try {
    const top = await prisma.$queryRaw`
      SELECT au.email, COUNT(u.id)::int AS requests
      FROM api_usage u
      JOIN api_keys k ON k.id = u.key_id
      JOIN api_users au ON au.id = k.user_id
      WHERE u.created_at >= ${start}
      GROUP BY au.email
      ORDER BY requests DESC
      LIMIT ${limit}
    `;
    return top;
  } catch {
    return [];
  }
}
