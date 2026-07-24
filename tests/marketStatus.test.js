import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getNyseHolidays,
  getNyseEarlyCloses,
  getMarketStatus,
  etWallToUtcDate,
  isTradingDay,
} from "../src/datacaptain/services/marketStatusService.js";

describe("NYSE holidays 2026", () => {
  it("matches published full closures", () => {
    const h = getNyseHolidays(2026);
    assert.equal(h.get("2026-01-01"), "New Year's Day");
    assert.equal(h.get("2026-01-19"), "Martin Luther King Jr. Day");
    assert.equal(h.get("2026-02-16"), "Washington's Birthday");
    assert.equal(h.get("2026-04-03"), "Good Friday");
    assert.equal(h.get("2026-05-25"), "Memorial Day");
    assert.equal(h.get("2026-06-19"), "Juneteenth National Independence Day");
    assert.equal(h.get("2026-07-03"), "Independence Day"); // Jul 4 is Saturday
    assert.equal(h.get("2026-09-07"), "Labor Day");
    assert.equal(h.get("2026-11-26"), "Thanksgiving Day");
    assert.equal(h.get("2026-12-25"), "Christmas Day");
  });

  it("early closes 2026", () => {
    const e = getNyseEarlyCloses(2026);
    assert.equal(e.has("2026-07-03"), false); // full holiday
    assert.equal(e.get("2026-11-27"), "Day after Thanksgiving");
    assert.equal(e.get("2026-12-24"), "Christmas Eve");
  });
});

describe("getMarketStatus", () => {
  it("CLOSED overnight Friday ET", () => {
    // 2026-07-24 01:41 EDT = 05:41 UTC
    const s = getMarketStatus(new Date("2026-07-24T05:41:00Z"));
    assert.equal(s.status, "CLOSED");
    assert.equal(s.session, "closed");
  });

  it("OPEN weekday mid-session EDT", () => {
    // Fri Jul 24 2026 10:00 EDT = 14:00 UTC
    const s = getMarketStatus(new Date("2026-07-24T14:00:00Z"));
    assert.equal(s.status, "OPEN");
    assert.equal(s.session, "regular");
    assert.equal(s.holiday, null);
  });

  it("CLOSED on Independence Day observance 2026-07-03", () => {
    const s = getMarketStatus(etWallToUtcDate(2026, 7, 3, 12, 0));
    assert.equal(s.status, "CLOSED");
    assert.equal(s.session, "holiday");
    assert.match(s.holiday, /Independence/);
  });

  it("early close session ends at 13:00", () => {
    // Thanksgiving+1 2026-11-27 12:30 ET still open
    const open = getMarketStatus(etWallToUtcDate(2026, 11, 27, 12, 30));
    assert.equal(open.status, "OPEN");
    assert.equal(open.session, "early_close");
    const closed = getMarketStatus(etWallToUtcDate(2026, 11, 27, 13, 0));
    assert.equal(closed.status, "CLOSED");
  });

  it("weekend closed", () => {
    const s = getMarketStatus(etWallToUtcDate(2026, 7, 25, 12, 0)); // Sat
    assert.equal(s.status, "CLOSED");
    assert.equal(isTradingDay(2026, 7, 25), false);
  });

  it("etWallToUtcDate round-trips noon EDT", () => {
    const d = etWallToUtcDate(2026, 7, 24, 12, 0);
    // July = EDT (UTC-4) → 16:00Z
    assert.equal(d.toISOString(), "2026-07-24T16:00:00.000Z");
  });
});
