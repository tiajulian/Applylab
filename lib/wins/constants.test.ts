import { describe, expect, it } from "vitest";
import { METRIC_BLANK, METRIC_PROMPTS, orderMetricPrompts } from "./constants";

describe("METRIC_PROMPTS", () => {
  it("never carries a number in a template, only a blank for the candidate's own", () => {
    for (const prompt of METRIC_PROMPTS) {
      expect(prompt.template).not.toMatch(/\d/);
      expect(prompt.template).toContain(METRIC_BLANK);
    }
  });

  it("puts the prompt matching the chosen outcome first and keeps every prompt", () => {
    const ordered = orderMetricPrompts("cut errors");
    expect(ordered[0].label).toBe("Fewer errors");
    expect(ordered).toHaveLength(METRIC_PROMPTS.length);
    expect(orderMetricPrompts("something else")).toEqual(METRIC_PROMPTS);
  });
});
