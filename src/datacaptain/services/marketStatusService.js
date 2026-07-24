/**
 * US equity market status (NYSE / Nasdaq regular session)
 *
 * Free, local calendar — no third-party API:
 * - Mon–Fri regular hours 09:30–16:00 America/New_York
 * - Full NYSE holidays (incl. Good Friday, Juneteenth)
 * - Early closes at 13:00 ET (day before Independence Day when applicable,
 *   day after Thanksgiving, Christmas Eve)
 */

const TZ = "America/New_York";
const OPEN_MINS = 9 * 60 + 30; // 09:30
const CLOSE_MINS = 16 * 60; // 16:00
const EARLY_CLOSE_MINS = 13 * 60; // 13:00

function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymd(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** nth weekday in month: weekday 0=Sun..6=Sat, n=1..5 (5 = last) */
function nthWeekday(year, month, weekday, n) {
  if (n === 5) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let d = last; d >= 1; d--) {
      if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === weekday) return d;
    }
    return last;
  }
  let count = 0;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = 1; d <= last; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() === weekday) {
      count += 1;
      if (count === n) return d;
    }
  }
  return 1;
}

/** Easter Sunday (Anonymous Gregorian algorithm) */
function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return { month, day };
}

/** Observe weekday for fixed holiday: Sat → Fri, Sun → Mon */
function observedFixed(year, month, day) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dow = dt.getUTCDay();
  if (dow === 6) {
    const prev = new Date(Date.UTC(year, month - 1, day - 1));
    return {
      year: prev.getUTCFullYear(),
      month: prev.getUTCMonth() + 1,
      day: prev.getUTCDate(),
    };
  }
  if (dow === 0) {
    const next = new Date(Date.UTC(year, month - 1, day + 1));
    return {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
    };
  }
  return { year, month, day };
}

/**
 * NYSE full-closure holidays for a calendar year.
 */
export function getNyseHolidays(year) {
  const map = new Map();

  const add = (y, m, d, name) => {
    if (y !== year) return;
    map.set(ymd(y, m, d), name);
  };

  // New Year's Day — Sat not observed Fri; Sun → Mon
  {
    const jan1Dow = new Date(Date.UTC(year, 0, 1)).getUTCDay();
    if (jan1Dow === 0) add(year, 1, 2, "New Year's Day");
    else if (jan1Dow !== 6) add(year, 1, 1, "New Year's Day");
  }

  add(year, 1, nthWeekday(year, 1, 1, 3), "Martin Luther King Jr. Day");
  add(year, 2, nthWeekday(year, 2, 1, 3), "Washington's Birthday");

  const easter = easterSunday(year);
  const goodFriday = new Date(Date.UTC(year, easter.month - 1, easter.day - 2));
  add(
    goodFriday.getUTCFullYear(),
    goodFriday.getUTCMonth() + 1,
    goodFriday.getUTCDate(),
    "Good Friday"
  );

  add(year, 5, nthWeekday(year, 5, 1, 5), "Memorial Day");

  {
    const j = observedFixed(year, 6, 19);
    add(j.year, j.month, j.day, "Juneteenth National Independence Day");
  }
  {
    const j = observedFixed(year, 7, 4);
    add(j.year, j.month, j.day, "Independence Day");
  }

  add(year, 9, nthWeekday(year, 9, 1, 1), "Labor Day");
  add(year, 11, nthWeekday(year, 11, 4, 4), "Thanksgiving Day");

  {
    const c = observedFixed(year, 12, 25);
    add(c.year, c.month, c.day, "Christmas Day");
  }

  return map;
}

/**
 * Early close dates (1:00 PM ET) for a year.
 */
export function getNyseEarlyCloses(year) {
  const holidays = getNyseHolidays(year);
  const map = new Map();

  const tryAdd = (m, d, name) => {
    const key = ymd(year, m, d);
    if (holidays.has(key)) return;
    const dow = new Date(Date.UTC(year, m - 1, d)).getUTCDay();
    if (dow === 0 || dow === 6) return;
    map.set(key, name);
  };

  // Day before Independence Day only when July 4 itself is a weekday (not already observed Jul 3)
  {
    const jul4Dow = new Date(Date.UTC(year, 6, 4)).getUTCDay();
    if (jul4Dow !== 0 && jul4Dow !== 6) {
      tryAdd(7, 3, "Day before Independence Day");
    }
  }

  const thanks = nthWeekday(year, 11, 4, 4);
  tryAdd(11, thanks + 1, "Day after Thanksgiving");
  tryAdd(12, 24, "Christmas Eve");

  return map;
}

function getEtParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  let hour = parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;

  const weekday = get("weekday");
  const dowMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    dow: dowMap[weekday] ?? 0,
    hour,
    minute: parseInt(get("minute"), 10),
    second: parseInt(get("second"), 10),
  };
}

/** Convert America/New_York wall-clock time to a UTC Date. */
export function etWallToUtcDate(year, month, day, hour, minute = 0, second = 0) {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 4; i++) {
    const parts = getEtParts(new Date(utc));
    const asEt =
      Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) /
      1000;
    const want = Date.UTC(year, month - 1, day, hour, minute, second) / 1000;
    utc += (want - asEt) * 1000;
  }
  return new Date(utc);
}

function addCalendarDays(year, month, day, delta) {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function holidayNameOn(year, month, day) {
  return getNyseHolidays(year).get(ymd(year, month, day)) ?? null;
}

function earlyCloseNameOn(year, month, day) {
  return getNyseEarlyCloses(year).get(ymd(year, month, day)) ?? null;
}

export function isTradingDay(year, month, day) {
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (dow === 0 || dow === 6) return false;
  if (holidayNameOn(year, month, day)) return false;
  return true;
}

function sessionCloseMins(year, month, day) {
  return earlyCloseNameOn(year, month, day) ? EARLY_CLOSE_MINS : CLOSE_MINS;
}

function nextTradingDay(year, month, day) {
  let cur = { year, month, day };
  for (let i = 0; i < 15; i++) {
    cur = addCalendarDays(cur.year, cur.month, cur.day, 1);
    if (isTradingDay(cur.year, cur.month, cur.day)) return cur;
  }
  return cur;
}

/**
 * @param {Date} [now]
 */
export function getMarketStatus(now = new Date()) {
  const et = getEtParts(now);
  const { year, month, day, dow, hour, minute } = et;
  const totalMins = hour * 60 + minute;
  const holiday = holidayNameOn(year, month, day);
  const earlyClose = earlyCloseNameOn(year, month, day);
  const trading = dow >= 1 && dow <= 5 && !holiday;
  const closeMins = trading ? sessionCloseMins(year, month, day) : CLOSE_MINS;

  let status = "CLOSED";
  let session = "closed";

  if (trading && totalMins >= OPEN_MINS && totalMins < closeMins) {
    status = "OPEN";
    session = earlyClose ? "early_close" : "regular";
  } else if (holiday) {
    session = "holiday";
  }

  let openTarget;
  if (status === "OPEN") {
    openTarget = { year, month, day };
  } else if (trading && totalMins < OPEN_MINS) {
    openTarget = { year, month, day };
  } else {
    openTarget = nextTradingDay(year, month, day);
  }

  const closeTargetMins = sessionCloseMins(openTarget.year, openTarget.month, openTarget.day);
  const nextClose = etWallToUtcDate(
    openTarget.year,
    openTarget.month,
    openTarget.day,
    Math.floor(closeTargetMins / 60),
    closeTargetMins % 60
  );

  let nextOpen;
  if (status === "OPEN") {
    const n = nextTradingDay(year, month, day);
    nextOpen = etWallToUtcDate(n.year, n.month, n.day, 9, 30);
  } else {
    nextOpen = etWallToUtcDate(openTarget.year, openTarget.month, openTarget.day, 9, 30);
  }

  return {
    market: "US",
    status,
    session,
    holiday: holiday || null,
    earlyClose: earlyClose || null,
    timezone: TZ,
    asOf: now.toISOString(),
    nextOpen: nextOpen.toISOString(),
    nextClose: nextClose.toISOString(),
  };
}
