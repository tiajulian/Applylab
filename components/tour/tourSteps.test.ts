import { describe, it, expect } from "vitest";
import { TOUR_STEPS } from "./tourSteps";

describe("TOUR_STEPS", () => {
  it("defines an array of steps starting with welcome and ending with completion", () => {
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(TOUR_STEPS[0].id).toBe("welcome");
    expect(TOUR_STEPS[0].placement).toBe("center");
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].id).toBe("complete");
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].placement).toBe("center");
  });

  it("contains unique step IDs", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("has non-empty titles and descriptions for every step", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.description.trim().length).toBeGreaterThan(0);
      if (step.id !== "welcome" && step.id !== "complete") {
        expect(step.target).toBeDefined();
        expect(step.target?.startsWith('[data-tour="')).toBe(true);
      }
    }
  });

  it("targets all primary navigation feature anchors", () => {
    const targets = TOUR_STEPS.map((s) => s.target).filter(Boolean);
    expect(targets).toContain('[data-tour="nav-profile"]');
    expect(targets).toContain('[data-tour="nav-documents"]');
    expect(targets).toContain('[data-tour="nav-cover-letters"]');
    expect(targets).toContain('[data-tour="nav-interview"]');
    expect(targets).toContain('[data-tour="nav-applications"]');
    expect(targets).toContain('[data-tour="nav-extension"]');
    expect(targets).toContain('[data-tour="nav-find-jobs"]');
  });

  it("says how many steps it has, and ends by sending people to their profile", () => {
    // Resumes and cover letters share step 2, so count step numbers, not step cards.
    const main = new Set(TOUR_STEPS.map((s) => /^Step (\d+):/.exec(s.title)?.[1]).filter(Boolean)).size;
    const extras = TOUR_STEPS.filter((s) => s.title.startsWith("Extra:")).length;
    expect(TOUR_STEPS[0].description).toContain(`${main} main steps and ${extras} extras`);
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].actionHref).toBe("/profile");
  });
});
