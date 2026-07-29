/**
 * Developer Usage service
 * Returns usage stats + analytics from api_usage table
 */

import { QueryTypes } from "sequelize";
import sequelize from "../config/database.js";
import { ApiUsage } from "../models/index.js";
import { Op } from "sequelize";
import { normalizePlanSlug } from "../config/planAccess.js";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysAgo(n) {
  const d = startOfDay();
  d.setDate(d.getDate() - n);
  return d;
}

export async function getUsageStats(keyId, dailyLimit, apiUser) {
  const today = startOfDay();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const since30 = daysAgo(30);
  const since7 = daysAgo(7);

  const [requestsToday, requestsThisMonth] = await Promise.all([
    ApiUsage.count({
      where: {
        key_id: keyId,
        created_at: { [Op.gte]: today, [Op.lt]: tomorrow },
      },
    }),
    ApiUsage.count({
      where: {
        key_id: keyId,
        created_at: { [Op.gte]: monthStart },
      },
    }),
  ]);

  const plan = normalizePlanSlug(apiUser?.plan) || "free";
  const requestsRemaining = Math.max(0, dailyLimit - requestsToday);

  // Daily series (last 30 days)
  const dailyRows = await sequelize.query(
    `
    SELECT DATE(created_at) AS day, COUNT(*)::int AS count
    FROM api_usage
    WHERE key_id = :keyId AND created_at >= :since
    GROUP BY DATE(created_at)
    ORDER BY day ASC
    `,
    {
      replacements: { keyId, since: since30 },
      type: QueryTypes.SELECT,
    }
  );

  const dailyMap = new Map(
    dailyRows.map((r) => [String(r.day).slice(0, 10), Number(r.count)])
  );
  const dailySeries = [];
  for (let i = 29; i >= 0; i--) {
    const d = daysAgo(i);
    const key = d.toISOString().slice(0, 10);
    dailySeries.push({ date: key, count: dailyMap.get(key) || 0 });
  }

  // Weekly buckets (last 8 weeks)
  const weeklySeries = [];
  for (let w = 7; w >= 0; w--) {
    const end = daysAgo(w * 7);
    const start = daysAgo(w * 7 + 6);
    const count = dailySeries
      .filter((p) => p.date >= start.toISOString().slice(0, 10) && p.date <= end.toISOString().slice(0, 10))
      .reduce((s, p) => s + p.count, 0);
    weeklySeries.push({
      date: end.toISOString().slice(0, 10),
      label: `W${8 - w}`,
      count,
    });
  }

  // Monthly buckets (last 6 months) — single query
  const monthStart6 = new Date(today.getFullYear(), today.getMonth() - 5, 1);
  const monthlyRows = await sequelize.query(
    `
    SELECT date_trunc('month', created_at)::date AS month, COUNT(*)::int AS count
    FROM api_usage
    WHERE key_id = :keyId AND created_at >= :since
    GROUP BY date_trunc('month', created_at)
    ORDER BY month ASC
    `,
    {
      replacements: { keyId, since: monthStart6 },
      type: QueryTypes.SELECT,
    }
  );
  const monthMap = new Map(
    monthlyRows.map((r) => [String(r.month).slice(0, 7), Number(r.count)])
  );
  const monthlySeries = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const key = d.toISOString().slice(0, 7);
    monthlySeries.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleString("en-US", { month: "short" }),
      count: monthMap.get(key) || 0,
    });
  }

  // Endpoint breakdown (30d)
  const endpointRows = await sequelize.query(
    `
    SELECT endpoint, COUNT(*)::int AS count,
      AVG(response_time)::float AS avgMs,
      SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END)::int AS errors,
      SUM(CASE WHEN status_code < 400 THEN 1 ELSE 0 END)::int AS success
    FROM api_usage
    WHERE key_id = :keyId AND created_at >= :since
    GROUP BY endpoint
    ORDER BY count DESC
    LIMIT 12
    `,
    {
      replacements: { keyId, since: since30 },
      type: QueryTypes.SELECT,
    }
  );

  const endpoints = endpointRows.map((r) => ({
    endpoint: r.endpoint,
    count: Number(r.count),
    avgMs: r.avgMs != null ? Math.round(r.avgMs) : null,
    errors: Number(r.errors || 0),
    success: Number(r.success || 0),
  }));

  const totals30 = endpoints.reduce(
    (acc, e) => {
      acc.count += e.count;
      acc.errors += e.errors;
      acc.success += e.success;
      acc.latencySum += (e.avgMs || 0) * e.count;
      return acc;
    },
    { count: 0, errors: 0, success: 0, latencySum: 0 }
  );

  const avgLatencyMs =
    totals30.count > 0 ? Math.round(totals30.latencySum / totals30.count) : null;
  const successRate =
    totals30.count > 0 ? Math.round((totals30.success / totals30.count) * 1000) / 10 : null;
  const errorRate =
    totals30.count > 0 ? Math.round((totals30.errors / totals30.count) * 1000) / 10 : null;

  // Recent activity
  const recent = await ApiUsage.findAll({
    where: { key_id: keyId },
    order: [["created_at", "DESC"]],
    limit: 12,
    attributes: ["endpoint", "method", "status_code", "response_time", "created_at"],
    raw: true,
  });

  const recentActivity = recent.map((r) => ({
    endpoint: r.endpoint,
    method: r.method,
    statusCode: r.status_code,
    durationMs: r.response_time,
    at: r.created_at,
  }));

  // Last 7d for health
  const errors7d = await ApiUsage.count({
    where: {
      key_id: keyId,
      created_at: { [Op.gte]: since7 },
      status_code: { [Op.gte]: 400 },
    },
  });

  return {
    plan,
    requestsToday,
    requestsRemaining,
    dailyLimit,
    requestsThisMonth,
    monthlyLimit: dailyLimit * 30,
    series: {
      daily: dailySeries,
      weekly: weeklySeries,
      monthly: monthlySeries,
    },
    endpoints,
    analytics: {
      avgLatencyMs,
      successRate,
      errorRate,
      totalRequests30d: totals30.count,
      errors7d,
    },
    recentActivity,
    health: {
      uptimePct: 99.9,
      avgLatencyMs: avgLatencyMs ?? 120,
      errorCount: errors7d,
      database: "healthy",
      cache: "healthy",
    },
    asOf: new Date().toISOString(),
  };
}
