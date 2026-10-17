import { describe, it, expect } from "vitest";
import {
  melbourneWallTimeToIso,
  toMelbourneDateTimeInputs,
  diffCalendarDaysMelbourne,
  formatRelativeDistanceMelbourne,
  formatAdCloseText,
  getMelbourneDateString,
  formatEnAuDate,
} from "@/lib/dateUtils";

describe("dateUtils (Australia/Melbourne)", () => {
  it("computes calendar day diff in Melbourne timezone", () => {
    expect(diffCalendarDaysMelbourne("2026-09-12", "2026-09-12")).toBe(0);
    expect(diffCalendarDaysMelbourne("2026-09-17", "2026-09-12")).toBe(5);
    expect(diffCalendarDaysMelbourne("2026-09-02", "2026-09-12")).toBe(-10);
  });

  it("formats relative distances correctly", () => {
    expect(formatRelativeDistanceMelbourne("2026-09-12", "2026-09-12")).toBe("today");
    expect(formatRelativeDistanceMelbourne("2026-09-13", "2026-09-12")).toBe("tomorrow");
    expect(formatRelativeDistanceMelbourne("2026-09-17", "2026-09-12")).toBe("in 5 days");
    expect(formatRelativeDistanceMelbourne("2026-09-11", "2026-09-12")).toBe("yesterday");
    expect(formatRelativeDistanceMelbourne("2026-09-02", "2026-09-12")).toBe("10 days ago");
  });

  it("formats deadline relative distances correctly", () => {
    expect(formatRelativeDistanceMelbourne("2026-09-12", "2026-09-12", true)).toBe("due today");
    expect(formatRelativeDistanceMelbourne("2026-09-13", "2026-09-12", true)).toBe("due tomorrow");
    expect(formatRelativeDistanceMelbourne("2026-09-17", "2026-09-12", true)).toBe("due in 5 days");
  });

  it("formats ad close tags properly", () => {
    // Today
    const today = formatAdCloseText("2026-09-12", "2026-09-12");
    expect(today.text).toBe("Closes today");
    expect(today.isUrgent).toBe(true);
    expect(today.isClosed).toBe(false);

    // Tomorrow
    const tomorrow = formatAdCloseText("2026-09-13", "2026-09-12");
    expect(tomorrow.text).toBe("Closes tomorrow");
    expect(tomorrow.isUrgent).toBe(true);

    // Past
    const past = formatAdCloseText("2026-09-05", "2026-09-12");
    expect(past.text).toContain("Closed");
    expect(past.isClosed).toBe(true);
    expect(past.isUrgent).toBe(false);
  });
});

describe("Melbourne wall time <-> instant", () => {
  it("reads a typed date and time as Melbourne time, across daylight saving", () => {
    // AEST (UTC+10) in winter, AEDT (UTC+11) in summer.
    expect(melbourneWallTimeToIso(2026, 7, 15, 10, 0)).toBe("2026-07-15T00:00:00.000Z");
    expect(melbourneWallTimeToIso(2026, 12, 1, 10, 0)).toBe("2026-11-30T23:00:00.000Z");
    expect(melbourneWallTimeToIso(2026, 1, 1, 0, 30)).toBe("2025-12-31T13:30:00.000Z");
  });

  it("round-trips through the form inputs unchanged", () => {
    for (const iso of ["2026-07-15T00:00:00.000Z", "2026-11-30T23:00:00.000Z", "2026-04-05T15:45:00.000Z"]) {
      const { date, time } = toMelbourneDateTimeInputs(iso);
      const [y, m, d] = date.split("-").map(Number);
      const [h, min] = time.split(":").map(Number);
      expect(melbourneWallTimeToIso(y, m, d, h, min)).toBe(iso);
    }
    expect(toMelbourneDateTimeInputs("2026-07-15T00:00:00.000Z")).toEqual({ date: "2026-07-15", time: "10:00" });
  });
});
