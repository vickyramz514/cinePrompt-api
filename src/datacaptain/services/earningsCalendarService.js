/**
 * Earnings calendar — upcoming and recent reports across symbols
 */

import { Op } from "sequelize";
import { Earnings, Stock, Company } from "../models/index.js";

function formatDate(d) {
  if (!d) return null;
  if (typeof d === "string") return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getNextEarning(symbol) {
  const today = new Date().toISOString().slice(0, 10);
  const row = await Earnings.findOne({
    where: {
      symbol: symbol.toUpperCase(),
      report_date: { [Op.gte]: today },
    },
    order: [["report_date", "ASC"]],
    raw: true,
  });
  if (!row) return null;
  return {
    reportDate: formatDate(row.report_date),
    eps: row.eps != null ? parseFloat(row.eps) : null,
    consensusEps: row.consensus_eps != null ? parseFloat(row.consensus_eps) : null,
    revenue: row.revenue != null ? Number(row.revenue) : null,
  };
}

/**
 * @param {{ from?: string, to?: string, symbol?: string, limit?: number }} opts
 */
export async function getEarningsCalendar(opts = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const from = opts.from || addDays(today, -7);
  const to = opts.to || addDays(today, 30);
  const limit = Math.min(opts.limit || 100, 200);

  const where = {
    report_date: { [Op.between]: [from, to] },
  };
  if (opts.symbol) {
    where.symbol = opts.symbol.toUpperCase();
  }

  const rows = await Earnings.findAll({
    where,
    order: [["report_date", "ASC"], ["symbol", "ASC"]],
    limit,
    raw: true,
  });

  const symbols = [...new Set(rows.map((r) => r.symbol))];
  const names = new Map();
  if (symbols.length) {
    const [stocks, companies] = await Promise.all([
      Stock.findAll({ where: { symbol: symbols }, raw: true }),
      Company.findAll({ where: { symbol: symbols }, raw: true }),
    ]);
    for (const s of stocks) names.set(s.symbol, s.name);
    for (const c of companies) {
      if (c.company_name) names.set(c.symbol, c.company_name);
    }
  }

  const events = rows.map((r) => {
    const reportDate = formatDate(r.report_date);
    const isUpcoming = reportDate >= today;
    return {
      symbol: r.symbol,
      companyName: names.get(r.symbol) || r.symbol,
      reportDate,
      timing: isUpcoming ? "upcoming" : "reported",
      eps: r.eps != null ? parseFloat(r.eps) : null,
      consensusEps: r.consensus_eps != null ? parseFloat(r.consensus_eps) : null,
      revenue: r.revenue != null ? Number(r.revenue) : null,
      surprise:
        r.eps != null && r.consensus_eps != null
          ? Math.round((parseFloat(r.eps) - parseFloat(r.consensus_eps)) * 100) / 100
          : null,
    };
  });

  return {
    from,
    to,
    count: events.length,
    events,
  };
}
