/**
 * Economic Indicators service - Macro data (CPI, GDP, etc.)
 */

import { EconomicIndicator } from "../models/index.js";

export async function getIndicators() {
  const rows = await EconomicIndicator.findAll({ raw: true });

  const result = {
    inflation: 3.2,
    interestRate: 5.25,
    gdpGrowth: 2.4,
    unemploymentRate: 3.8,
  };

  for (const r of rows) {
    const name = (r.indicator_name || "").toLowerCase();
    const value = parseFloat(r.value);

    if (name.includes("cpi") || name.includes("inflation")) {
      result.inflation = value;
    } else if (name.includes("interest")) {
      result.interestRate = value;
    } else if (name.includes("gdp")) {
      result.gdpGrowth = value;
    } else if (name.includes("unemployment")) {
      result.unemploymentRate = value;
    }
  }

  return result;
}
