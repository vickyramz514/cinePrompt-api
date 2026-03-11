/**
 * Market Status service
 * US stock market hours: 9:30 AM – 4:00 PM EST, Monday–Friday
 */

function getETParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekday = get("weekday");
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  const dowMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
  const dow = dowMap[weekday] ?? 0;

  return { dow, hour, minute };
}

function isMarketOpen(dow, hour, minute) {
  if (dow === 0 || dow === 6) return false;
  const totalMins = hour * 60 + minute;
  return totalMins >= 570 && totalMins < 960;
}

function getNextOpenCloseET() {
  const { dow, hour, minute } = getETParts();
  const totalMins = hour * 60 + minute;

  let daysUntilOpen = 0;
  let daysUntilClose = 0;

  if (dow === 0) {
    daysUntilOpen = 1;
    daysUntilClose = 1;
  } else if (dow === 6) {
    daysUntilOpen = 2;
    daysUntilClose = 2;
  } else if (totalMins < 570) {
    daysUntilClose = 0;
  } else if (totalMins >= 960) {
    daysUntilOpen = dow === 5 ? 3 : 1;
    daysUntilClose = dow === 5 ? 3 : 1;
  } else {
    daysUntilClose = 0;
  }

  const base = new Date();
  const openDate = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + daysUntilOpen,
    14, 30, 0, 0
  ));
  const closeDate = new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + daysUntilClose,
    21, 0, 0, 0
  ));

  return {
    nextOpen: openDate.toISOString(),
    nextClose: closeDate.toISOString(),
  };
}

export function getMarketStatus() {
  const { dow, hour, minute } = getETParts();
  const status = isMarketOpen(dow, hour, minute) ? "OPEN" : "CLOSED";
  const { nextOpen, nextClose } = getNextOpenCloseET();

  return {
    market: "US",
    status,
    nextOpen,
    nextClose,
  };
}
