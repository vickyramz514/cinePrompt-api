/**
 * Preset ETF baskets for heatmap visualization
 */

export const HEATMAP_BASKETS = {
  broad: {
    label: "Broad Market",
    symbols: ["SPY", "VOO", "VTI", "IVV", "QQQ", "DIA", "IWM", "RSP", "ITOT", "SCHB"],
  },
  dividend: {
    label: "Dividend ETFs",
    symbols: ["SCHD", "VIG", "DVY", "HDV", "DGRO", "SDY", "NOBL", "VYM", "SPYD"],
  },
  sector: {
    label: "Sector ETFs",
    symbols: ["XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC"],
  },
  growth: {
    label: "Growth ETFs",
    symbols: ["QQQ", "VUG", "IVW", "MGK", "SCHG", "IWF", "ARKK"],
  },
  value: {
    label: "Value ETFs",
    symbols: ["VTV", "IVE", "IWD", "SCHV", "VLUE", "SPYV"],
  },
  technology: {
    label: "Technology",
    symbols: ["XLK", "VGT", "QQQ", "SMH", "SOXX", "IGV", "FTEC"],
  },
  healthcare: {
    label: "Healthcare",
    symbols: ["XLV", "VHT", "IHI", "IBB", "XBI", "IHF"],
  },
  financial: {
    label: "Financial",
    symbols: ["XLF", "VFH", "KRE", "KBE", "IYF", "FNCL"],
  },
  energy: {
    label: "Energy",
    symbols: ["XLE", "VDE", "XOP", "OIH", "IYE", "AMLP"],
  },
  utilities: {
    label: "Utilities",
    symbols: ["XLU", "VPU", "IDU", "FUTY", "RYU"],
  },
  bonds: {
    label: "Bond ETFs",
    symbols: ["BND", "AGG", "TLT", "SHY", "IEF", "LQD", "HYG", "TIP", "VCIT"],
  },
  international: {
    label: "International",
    symbols: ["VXUS", "VEA", "EFA", "IEFA", "IXUS", "SCHF", "VEU"],
  },
  emerging: {
    label: "Emerging Markets",
    symbols: ["VWO", "IEMG", "EEM", "SCHE", "FNDE", "SPEM"],
  },
  commodity: {
    label: "Commodity ETFs",
    symbols: ["GLD", "IAU", "SLV", "USO", "DBC", "PDBC", "UNG"],
  },
  leveraged: {
    label: "Leveraged ETFs",
    symbols: ["TQQQ", "UPRO", "SOXL", "TNA", "SPXL", "TECL"],
  },
  inverse: {
    label: "Inverse ETFs",
    symbols: ["SQQQ", "SPXU", "SH", "PSQ", "SDS", "TZA"],
  },
  esg: {
    label: "ESG ETFs",
    symbols: ["ESGU", "ESGV", "SUSA", "DSI", "USSG", "ESGE"],
  },
};

/** Approximate AUM (USD billions) & expense ratios for sizing/sort when live AUM is unavailable */
export const ETF_STATIC_META = {
  SPY: { aumBillions: 550, expenseRatio: 0.09 },
  VOO: { aumBillions: 480, expenseRatio: 0.03 },
  IVV: { aumBillions: 450, expenseRatio: 0.03 },
  VTI: { aumBillions: 400, expenseRatio: 0.03 },
  QQQ: { aumBillions: 280, expenseRatio: 0.2 },
  ITOT: { aumBillions: 55, expenseRatio: 0.03 },
  SCHB: { aumBillions: 28, expenseRatio: 0.03 },
  RSP: { aumBillions: 55, expenseRatio: 0.2 },
  VEA: { aumBillions: 130, expenseRatio: 0.05 },
  IEFA: { aumBillions: 110, expenseRatio: 0.07 },
  EFA: { aumBillions: 55, expenseRatio: 0.32 },
  VXUS: { aumBillions: 70, expenseRatio: 0.07 },
  IXUS: { aumBillions: 35, expenseRatio: 0.07 },
  SCHF: { aumBillions: 40, expenseRatio: 0.06 },
  VEU: { aumBillions: 35, expenseRatio: 0.07 },
  VWO: { aumBillions: 80, expenseRatio: 0.08 },
  IEMG: { aumBillions: 75, expenseRatio: 0.09 },
  EEM: { aumBillions: 20, expenseRatio: 0.68 },
  SCHE: { aumBillions: 9, expenseRatio: 0.11 },
  AGG: { aumBillions: 100, expenseRatio: 0.03 },
  BND: { aumBillions: 100, expenseRatio: 0.03 },
  TLT: { aumBillions: 50, expenseRatio: 0.15 },
  SHY: { aumBillions: 25, expenseRatio: 0.15 },
  IEF: { aumBillions: 30, expenseRatio: 0.15 },
  LQD: { aumBillions: 30, expenseRatio: 0.14 },
  HYG: { aumBillions: 15, expenseRatio: 0.49 },
  TIP: { aumBillions: 18, expenseRatio: 0.19 },
  VCIT: { aumBillions: 45, expenseRatio: 0.04 },
  IWM: { aumBillions: 60, expenseRatio: 0.19 },
  DIA: { aumBillions: 35, expenseRatio: 0.16 },
  XLK: { aumBillions: 70, expenseRatio: 0.09 },
  XLF: { aumBillions: 40, expenseRatio: 0.09 },
  XLE: { aumBillions: 35, expenseRatio: 0.09 },
  XLV: { aumBillions: 40, expenseRatio: 0.09 },
  XLI: { aumBillions: 18, expenseRatio: 0.09 },
  XLY: { aumBillions: 18, expenseRatio: 0.09 },
  XLP: { aumBillions: 15, expenseRatio: 0.09 },
  XLU: { aumBillions: 14, expenseRatio: 0.09 },
  XLB: { aumBillions: 5, expenseRatio: 0.09 },
  XLRE: { aumBillions: 6, expenseRatio: 0.09 },
  XLC: { aumBillions: 18, expenseRatio: 0.09 },
  VGT: { aumBillions: 75, expenseRatio: 0.1 },
  SMH: { aumBillions: 20, expenseRatio: 0.35 },
  SOXX: { aumBillions: 12, expenseRatio: 0.35 },
  SCHD: { aumBillions: 55, expenseRatio: 0.06 },
  VIG: { aumBillions: 85, expenseRatio: 0.06 },
  VYM: { aumBillions: 55, expenseRatio: 0.06 },
  DVY: { aumBillions: 18, expenseRatio: 0.38 },
  HDV: { aumBillions: 10, expenseRatio: 0.08 },
  DGRO: { aumBillions: 28, expenseRatio: 0.08 },
  GLD: { aumBillions: 60, expenseRatio: 0.4 },
  IAU: { aumBillions: 30, expenseRatio: 0.25 },
  SLV: { aumBillions: 12, expenseRatio: 0.5 },
  USO: { aumBillions: 1.5, expenseRatio: 0.7 },
  DBC: { aumBillions: 1.4, expenseRatio: 0.87 },
  VUG: { aumBillions: 120, expenseRatio: 0.04 },
  VTV: { aumBillions: 110, expenseRatio: 0.04 },
  IWF: { aumBillions: 90, expenseRatio: 0.19 },
  IWD: { aumBillions: 55, expenseRatio: 0.19 },
  ARKK: { aumBillions: 7, expenseRatio: 0.75 },
  TQQQ: { aumBillions: 20, expenseRatio: 0.86 },
  SQQQ: { aumBillions: 2.5, expenseRatio: 0.95 },
  UPRO: { aumBillions: 3.5, expenseRatio: 0.91 },
  SOXL: { aumBillions: 10, expenseRatio: 0.76 },
  ESGU: { aumBillions: 13, expenseRatio: 0.15 },
  ESGV: { aumBillions: 10, expenseRatio: 0.09 },
  SUSA: { aumBillions: 3.5, expenseRatio: 0.25 },
};

/** Infer issuer from common ETF name / ticker patterns */
export function inferIssuer(symbol, name = "") {
  const n = (name || "").toLowerCase();
  const s = (symbol || "").toUpperCase();
  if (n.includes("vanguard") || ["VOO", "VTI", "VUG", "VTV", "VGT", "VYM", "VIG", "VXUS", "VEA", "VWO", "BND", "ESGV", "VHT", "VFH", "VDE", "VPU", "VEU"].includes(s))
    return "Vanguard";
  if (n.includes("ishares") || ["IVV", "IEFA", "IEMG", "IWF", "IWD", "ITOT", "AGG", "IWM", "EFA", "EEM", "HYG", "LQD", "TIP", "IEF", "SHY", "IXUS"].includes(s))
    return "iShares";
  if (n.includes("spdr") || n.includes("state street") || ["SPY", "XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE", "XLC", "DIA", "GLD", "MDY", "SPYD"].includes(s))
    return "State Street";
  if (n.includes("invesco") || ["QQQ", "RSP", "QQQM"].includes(s)) return "Invesco";
  if (n.includes("schwab") || s.startsWith("SCH")) return "Schwab";
  if (n.includes("ark") || s.startsWith("ARK")) return "ARK";
  if (n.includes("proshares") || ["TQQQ", "SQQQ", "UPRO", "SH", "PSQ", "SDS", "SPXU"].includes(s)) return "ProShares";
  if (n.includes("direxion") || ["SOXL", "TNA", "SPXL", "TECL", "TZA"].includes(s)) return "Direxion";
  return "Other";
}

/** Primary category badge from basket membership */
export function classifyEtf(symbol) {
  const s = (symbol || "").toUpperCase();
  const badges = [];
  const inBasket = (id) => HEATMAP_BASKETS[id]?.symbols?.includes(s);

  if (inBasket("leveraged")) badges.push("Leveraged");
  if (inBasket("inverse")) badges.push("Inverse");
  if (inBasket("esg")) badges.push("ESG");
  if (inBasket("bonds")) badges.push("Bond ETF");
  if (inBasket("dividend")) badges.push("Dividend ETF");
  if (inBasket("technology")) badges.push("Technology ETF");
  if (inBasket("broad")) badges.push("Broad Market");
  if (inBasket("sector") || inBasket("healthcare") || inBasket("financial") || inBasket("energy") || inBasket("utilities"))
    badges.push("Sector ETF");
  if (inBasket("international") || inBasket("emerging")) badges.push("International");
  if (inBasket("growth")) badges.push("Growth");
  if (inBasket("commodity")) badges.push("Commodity");

  let category = "Equity";
  if (inBasket("bonds")) category = "Bond";
  else if (inBasket("commodity")) category = "Commodity";
  else if (inBasket("technology")) category = "Technology";
  else if (inBasket("dividend")) category = "Dividend";
  else if (inBasket("international") || inBasket("emerging")) category = "International";
  else if (inBasket("growth")) category = "Growth";
  else if (inBasket("leveraged")) category = "Leveraged";
  else if (inBasket("inverse")) category = "Inverse";
  else if (inBasket("broad")) category = "Broad Market";
  else if (inBasket("sector")) category = "Sector";

  return {
    category,
    badges: [...new Set(badges)],
    leveraged: inBasket("leveraged"),
    inverse: inBasket("inverse"),
    esg: inBasket("esg"),
  };
}

export function symbolsForCategory(categoryId) {
  if (!categoryId) return null;
  if (HEATMAP_BASKETS[categoryId]) return HEATMAP_BASKETS[categoryId].symbols;
  return null;
}

export const VALID_PERIODS = new Set([
  "1d",
  "1w",
  "1m",
  "3m",
  "6m",
  "ytd",
  "1y",
  "3y",
  "5y",
  "10y",
  "max",
]);

/** Cached columns on etf_metrics */
export function resolvePeriodField(period) {
  switch (period) {
    case "ytd":
      return "return_ytd";
    case "3y":
      return "return_3y";
    case "5y":
      return "return_5y";
    case "1y":
      return "return_1y";
    default:
      return null; // compute from price history
  }
}

export function periodLookbackDays(period) {
  switch (period) {
    case "1d":
      return 1;
    case "1w":
      return 7;
    case "1m":
      return 30;
    case "3m":
      return 91;
    case "6m":
      return 182;
    case "1y":
      return 365;
    case "3y":
      return 365 * 3;
    case "5y":
      return 365 * 5;
    case "10y":
      return 365 * 10;
    case "max":
      return null;
    default:
      return 365;
  }
}
