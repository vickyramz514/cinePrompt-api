/**
 * Preset ETF baskets for heatmap visualization
 */

export const HEATMAP_BASKETS = {
  broad: {
    label: "Broad Market",
    symbols: ["SPY", "VOO", "VTI", "IVV", "QQQ", "DIA", "IWM", "RSP"],
  },
  dividend: {
    label: "Dividend ETFs",
    symbols: ["SCHD", "VIG", "DVY", "HDV", "DGRO", "SDY", "NOBL"],
  },
  sector: {
    label: "Sector SPDRs",
    symbols: ["XLK", "XLF", "XLE", "XLV", "XLI", "XLY", "XLP", "XLU", "XLB", "XLRE"],
  },
  growth: {
    label: "Growth & Thematic",
    symbols: ["QQQ", "VOO", "VTV", "IWM", "ARKK", "VUG", "MGK"],
  },
  bonds: {
    label: "Bond ETFs",
    symbols: ["BND", "AGG", "TLT", "SHY", "IEF", "LQD", "HYG"],
  },
};

export const VALID_PERIODS = new Set(["ytd", "1y", "3y", "5y"]);

export function resolvePeriodField(period) {
  switch (period) {
    case "ytd":
      return "return_ytd";
    case "3y":
      return "return_3y";
    case "5y":
      return "return_5y";
    case "1y":
    default:
      return "return_1y";
  }
}
