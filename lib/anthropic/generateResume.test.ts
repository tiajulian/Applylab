import { describe, expect, it, vi } from "vitest";

// Only the pure prompt formatter is under test; stub the gateway so importing doesn't build AI clients.
vi.mock("@/lib/aiGateway/gateway", () => ({ callGateway: vi.fn(), gemini: {}, geminiOutputTokens: vi.fn() }));

import { formatDuty } from "./generateResume";

describe("formatDuty", () => {
  const base = { job_title: "Data Analyst", duty_text: "Wrote SQL queries for team reports" };

  it("returns the plain duty text when nothing else was captured", () => {
    expect(formatDuty(base)).toBe("Wrote SQL queries for team reports");
  });

  it("appends the candidate's captured impact and metric", () => {
    expect(formatDuty({ ...base, outcome_text: "Faster month-end", outcome_metric: "2 days saved" })).toBe(
      "Wrote SQL queries for team reports (candidate-captured impact: Faster month-end, metric: 2 days saved)"
    );
  });

  it("passes the candidate's tool and stakeholder picks through to the prompt", () => {
    expect(formatDuty({ ...base, tools: ["dbt", "Snowflake"], stakeholders: ["Finance team"] })).toBe(
      "Wrote SQL queries for team reports [tools: dbt, Snowflake; for: Finance team]"
    );
  });

  it("combines impact with tools when both are present", () => {
    expect(formatDuty({ ...base, outcome_text: "Faster month-end", tools: ["dbt"] })).toBe(
      "Wrote SQL queries for team reports (candidate-captured impact: Faster month-end) [tools: dbt]"
    );
  });
});
