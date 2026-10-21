import { describe, expect, it } from "vitest";
import { showMetric } from "./metricDisplay";

describe("showMetric", () => {
  it.each([
    // Hidden: the line already states this exact result.
    ["Reduced vendor accreditation time from 6.8 days to 1.4 days", "5.4 days", false],
    ["Cut errors by 40%", "40%", false],
    ["Cut costs by 40 per cent", "40%", false],
    ["Cut errors from 10% to 6%", "40%", false],
    ["Cut errors from 10% to 6%", "4%", false],
    ["Raised 2m", "2 million", false],
    ["Saved $2m a year", "$2m", false],
    ["Handled 1,200 tickets", "1200", false],
    // Shown: the line's numbers are about something else.
    ["Ran a $2m budget across 3 sites", "cut waste 15%", true],
    ["Ran a $2m budget across 3 sites", "saved $400k", true],
    ["Covered the 24 hour support desk for 3 months", "CSAT up 12%", true],
    ["Covered the 24 hour support desk", "response time down 2 hours", true],
    ["Cut onboarding to 3 days", "by 2 days", true],
    ["Led a team of 12 on the Q3 rebuild", "12%", true],
    ["Migrated mailboxes to Office 365", "2 days faster", true],
    ["Sped up vendor accreditation", "5.4 days", true],
  ])("%s / %s -> shown: %s", (text, metric, shown) => {
    expect(showMetric(text, metric)).toBe(shown);
  });

  it("shows nothing when there's no metric, and always shows a metric with no figure in it", () => {
    expect(showMetric("Built dashboards", "")).toBe(false);
    expect(showMetric("Built dashboards", undefined)).toBe(false);
    expect(showMetric("Cut errors by 40%", "much faster")).toBe(true);
  });
});
