import { describe, it, expect } from "vitest";
import { FREE_RESUME_LIMIT } from "@/lib/limits";
import { PLANS, PRO_PRICES, formatAud, perMonthCents, savingPercent } from "./plans";

describe("PLANS", () => {
  it("states the real free resume limit, so marketing can't drift from the code", () => {
    expect(PLANS.free.features[0]).toContain(String(FREE_RESUME_LIMIT));
  });

  it("names the paid plan Pro", () => {
    expect(PLANS.pro.name).toBe("Pro");
  });
});

describe("price helpers", () => {
  it("formats whole and fractional dollars with the A$ prefix", () => {
    expect(formatAud(2900)).toBe("A$29");
    expect(formatAud(1967)).toBe("A$19.67");
    expect(formatAud(0)).toBe("A$0");
  });

  it("derives the quarterly per-month figure, rounded to the cent", () => {
    expect(perMonthCents(5900, 3)).toBe(1967);
  });

  it("derives the saving, rounded down to a whole percent", () => {
    // 1 - 59 / 87 = 32.18%
    expect(savingPercent(2900, 5900, 3)).toBe(32);
  });
});

describe("PRO_PRICES", () => {
  it("matches the decided Stripe amounts", () => {
    expect(PRO_PRICES.month.amountCents).toBe(2900);
    expect(PRO_PRICES.quarter.amountCents).toBe(5900);
    expect(PRO_PRICES.quarter.intervalCount).toBe(3);
  });

  it("shows exact derived labels", () => {
    expect(PRO_PRICES.month.buttonLabel).toBe("A$29 / month");
    expect(PRO_PRICES.quarter.buttonLabel).toBe("A$59 / 3 months");
    expect(PRO_PRICES.quarter.perMonthLabel).toBe("A$19.67/month");
    expect(PRO_PRICES.quarter.savingLabel).toBe("Save 32%");
  });
});
