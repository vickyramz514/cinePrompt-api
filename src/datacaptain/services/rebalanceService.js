/**
 * ETF portfolio rebalancer — drift detection and trade suggestions
 */

import { Op } from "sequelize";
import { Stock } from "../models/index.js";
import { ValidationError, NotFoundError } from "../../utils/errors.js";
import * as batchPricesService from "./batchPricesService.js";

const MAX_POSITIONS = 20;
const WEIGHT_TOLERANCE = 0.5;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

function parseSymbols(items, field) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError(`${field} must be a non-empty array`);
  }
  if (items.length > MAX_POSITIONS) {
    throw new ValidationError(`Maximum ${MAX_POSITIONS} positions allowed`);
  }
  return items.map((item, i) => {
    const symbol = String(item.symbol || "")
      .trim()
      .toUpperCase();
    if (!symbol) {
      throw new ValidationError(`${field}[${i}].symbol is required`);
    }
    return { ...item, symbol };
  });
}

async function assertEtfSymbols(symbols) {
  const unique = [...new Set(symbols)];
  const rows = await Stock.findAll({
    where: { symbol: { [Op.in]: unique }, type: "ETF" },
    attributes: ["symbol", "name"],
    raw: true,
  });
  const found = new Map(rows.map((r) => [r.symbol, r.name]));
  const missing = unique.filter((s) => !found.has(s));
  if (missing.length) {
    throw new NotFoundError(
      `ETF not found: ${missing.join(", ")}. Data Captain supports ETF symbols only.`
    );
  }
  return found;
}

function normalizeTargetWeights(target) {
  const parsed = target.map((t) => {
    const weight = parseFloat(t.weight);
    if (!Number.isFinite(weight) || weight < 0) {
      throw new ValidationError(`Invalid target weight for ${t.symbol}`);
    }
    return { symbol: t.symbol, weight };
  });

  const sum = parsed.reduce((s, t) => s + t.weight, 0);
  if (sum <= 0) throw new ValidationError("Target weights must sum to a positive value");
  if (Math.abs(sum - 100) > WEIGHT_TOLERANCE) {
    throw new ValidationError(`Target weights must sum to 100% (got ${round2(sum)}%)`);
  }

  return parsed.map((t) => ({
    symbol: t.symbol,
    weight: round2((t.weight / sum) * 100),
  }));
}

/**
 * @param {{
 *   holdings: Array<{ symbol: string, shares?: number, value?: number }>,
 *   target: Array<{ symbol: string, weight: number }>,
 *   driftThreshold?: number,
 *   mode?: 'rebalance' | 'contributions_only',
 * }} input
 */
export async function rebalancePortfolio(input) {
  const holdings = parseSymbols(input.holdings, "holdings");
  const target = normalizeTargetWeights(parseSymbols(input.target, "target"));
  const driftThreshold = Math.max(0, parseFloat(input.driftThreshold) || 0);
  const mode = input.mode === "contributions_only" ? "contributions_only" : "rebalance";

  const allSymbols = [...new Set([...holdings.map((h) => h.symbol), ...target.map((t) => t.symbol)])];
  const nameBySymbol = await assertEtfSymbols(allSymbols);

  const pricesRaw = await batchPricesService.getBatchPrices(allSymbols.join(","));
  const priceBySymbol = new Map(pricesRaw.map((p) => [p.symbol, p.price]));

  for (const sym of allSymbols) {
    if (!priceBySymbol.has(sym) || priceBySymbol.get(sym) <= 0) {
      throw new ValidationError(`No price available for ${sym}`);
    }
  }

  const holdingBySymbol = new Map(holdings.map((h) => [h.symbol, h]));
  const targetBySymbol = new Map(target.map((t) => [t.symbol, t.weight]));

  let totalValue = 0;
  const currentPositions = [];

  for (const sym of allSymbols) {
    const h = holdingBySymbol.get(sym);
    const price = priceBySymbol.get(sym);
    let shares = 0;
    let value = 0;

    if (h) {
      if (h.shares != null && h.shares !== "") {
        shares = parseFloat(h.shares);
        if (!Number.isFinite(shares) || shares < 0) {
          throw new ValidationError(`Invalid shares for ${sym}`);
        }
        value = shares * price;
      } else if (h.value != null && h.value !== "") {
        value = parseFloat(h.value);
        if (!Number.isFinite(value) || value < 0) {
          throw new ValidationError(`Invalid value for ${sym}`);
        }
        shares = value / price;
      }
    }

    totalValue += value;
    currentPositions.push({
      symbol: sym,
      name: nameBySymbol.get(sym),
      shares: round4(shares),
      price: round2(price),
      value: round2(value),
    });
  }

  if (totalValue <= 0) {
    throw new ValidationError("Portfolio total value must be greater than zero");
  }

  const allocation = currentPositions.map((pos) => {
    const targetWeight = targetBySymbol.get(pos.symbol) ?? 0;
    const currentWeight = round2((pos.value / totalValue) * 100);
    const drift = round2(targetWeight - currentWeight);
    const targetValue = (targetWeight / 100) * totalValue;
    const tradeValue = round2(targetValue - pos.value);
    const tradeShares = round4(tradeValue / pos.price);

    let action = "HOLD";
    if (Math.abs(drift) >= driftThreshold) {
      if (tradeValue > 0) action = "BUY";
      else if (tradeValue < 0) action = "SELL";
    }

    if (mode === "contributions_only" && action === "SELL") {
      action = "HOLD";
    }

    return {
      symbol: pos.symbol,
      name: pos.name,
      price: pos.price,
      shares: pos.shares,
      currentValue: pos.value,
      currentWeight,
      targetWeight,
      drift,
      tradeValue: action === "HOLD" ? 0 : tradeValue,
      tradeShares: action === "HOLD" ? 0 : Math.abs(tradeShares),
      action,
      reason:
        action === "HOLD"
          ? Math.abs(drift) < driftThreshold
            ? `Within ${driftThreshold}% threshold`
            : mode === "contributions_only"
              ? "Contributions-only mode (no sells)"
              : "Balanced"
          : `${Math.abs(drift)}% ${drift > 0 ? "underweight" : "overweight"}`,
    };
  });

  const trades = allocation
    .filter((a) => a.action === "BUY" || a.action === "SELL")
    .map((a) => ({
      symbol: a.symbol,
      name: a.name,
      action: a.action,
      shares: a.tradeShares,
      value: Math.abs(a.tradeValue),
      reason: a.reason,
    }));

  const maxDrift = allocation.reduce(
    (max, a) => (Math.abs(a.drift) > Math.abs(max.drift) ? a : max),
    allocation[0]
  );

  return {
    totalValue: round2(totalValue),
    driftThreshold,
    mode,
    needsRebalance: trades.length > 0,
    maxDrift: maxDrift ? { symbol: maxDrift.symbol, drift: maxDrift.drift } : null,
    allocation,
    trades,
  };
}
