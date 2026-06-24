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
]);

/** Free plan: path patterns */
export const FREE_API_PATH_PATTERNS = [];

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

/**
 * @param {string} path - e.g. /stocks/prices or /options/AAPL
 * @param {string} [method]
 */
export function isApiPathAllowedForPlan(path, method = "GET", plan) {
  if (method !== "GET") return false;
  if (!isFreePlan(plan)) return true;

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
