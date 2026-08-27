import { describe, it, expect } from "vitest";
import {
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
