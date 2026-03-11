/**
 * Dividend and Earnings services
 */

import { Dividend, Earnings } from "../models/index.js";

export async function getDividends(symbol, limit = 50) {
  const rows = await Dividend.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["ex_date", "DESC"]],
    limit,
    raw: true,
  });
  return rows.map((r) => ({
    exDate: r.ex_date,
    amount: parseFloat(r.amount),
    paymentDate: r.payment_date,
  }));
}

export async function getEarnings(symbol, limit = 20) {
  const rows = await Earnings.findAll({
    where: { symbol: symbol.toUpperCase() },
    order: [["report_date", "DESC"]],
    limit,
    raw: true,
  });
  return rows.map((r) => ({
    reportDate: r.report_date,
    eps: r.eps ? parseFloat(r.eps) : null,
    revenue: r.revenue ? Number(r.revenue) : null,
    consensusEps: r.consensus_eps ? parseFloat(r.consensus_eps) : null,
  }));
}
