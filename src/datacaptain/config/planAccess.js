/**
 * Free vs paid API access (DataCaptain routes, path relative to /api mount).
 */

export const FREE_PLAN_SLUGS = new Set(["free"]);

export const PAID_PLAN_SLUGS = new Set([
  "starter",
  "creator",
  "pro",
  "ultra",
  "enterprise",
]);

/** GET paths available on the free plan (exact match) */
export const FREE_API_PATHS = new Set([
  "/developer/usage",
  "/market/status",
  "/stocks/prices",
  "/etf/list",
  "/etf/heatmap",
  "/etf/heatmap/baskets",
  "/etf/screener",
  "/etf/rankings",
]);

/**
 * Free plan: path patterns (checked after exact FREE_API_PATHS).
 * Single-segment ETF detail only — /etf/list, /etf/heatmap, etc. remain exact matches
 * in FREE_API_PATHS (and would also match these patterns if listed there first).
 * Multi-segment paths like /etf/heatmap/baskets do NOT match.
 */
export const FREE_API_PATH_PATTERNS = [
  /^\/etf\/[A-Za-z0-9.-]+$/,
  /^\/stocks\/[A-Za-z0-9.-]+\/history$/,
];

export function normalizePlanSlug(plan) {
  return String(plan || "free")
    .toLowerCase()
    .trim();
}

export function isFreePlan(plan) {
  const slug = normalizePlanSlug(plan);
  if (FREE_PLAN_SLUGS.has(slug)) return true;
  if (PAID_PLAN_SLUGS.has(slug)) return false;
  return slug === "free" || !slug;
}

const PLAN_RANK = {
  free: 0,
  starter: 1,
  creator: 2,
  pro: 3,
  ultra: 4,
  enterprise: 5,
};

/** Highest-tier plan slug from dashboard / subscription / api_users sources. */
export function bestPlanSlug(...plans) {
  let best = "free";
  let bestRank = -1;
  for (const plan of plans) {
    const slug = normalizePlanSlug(plan);
    const rank = PLAN_RANK[slug] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = slug;
    }
  }
  return best;
}

/**
 * @param {string} path - e.g. /stocks/prices or /options/AAPL
 * @param {string} [method]
 */
export function isApiPathAllowedForPlan(path, method = "GET", plan) {
  if (!isFreePlan(plan)) return true;
  if (method !== "GET") return false;

  const normalized = path.split("?")[0];
  if (FREE_API_PATHS.has(normalized)) return true;
  if (FREE_API_PATH_PATTERNS.some((re) => re.test(normalized))) return true;

  return false;
}

export const PLAN_DAILY_LIMITS = {
  free: 50,
  starter: 1_000,
  creator: 10_000,
  pro: 10_000,
  ultra: 100_000,
  enterprise: 1_000_000,
};

export function dailyLimitForPlan(plan) {
  const slug = normalizePlanSlug(plan);
  return PLAN_DAILY_LIMITS[slug] ?? PLAN_DAILY_LIMITS.free;
}
