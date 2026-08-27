import { describe, it, expect } from "vitest";
import { evaluateAttentionItems } from "@/lib/dashboard/attention";

describe("evaluateAttentionItems", () => {
  it("flags upcoming interview round for practice", () => {
    const apps = [
      {
        id: "app-1",
        company_name: "Macquarie Group",
        job_title: "Risk Analyst",
        status: "interviewing",
      },
    ];

    const futureDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const interviews = [
      {
        id: "int-1",
        application_id: "app-1",
        stage_type: "panel",
        scheduled_at: futureDate,
        outcome: "scheduled",
      },
    ];

    const items = evaluateAttentionItems(apps, interviews, [], []);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("upcoming_interview");
    expect(items[0].title).toContain("Practise panel round");
    expect(items[0].actionHref).toContain("/interview?application=app-1&stage=panel");
  });

  it("flags past scheduled interview round with outcome needed", () => {
    const apps = [
      {
        id: "app-1",
        company_name: "Atlassian",
        job_title: "Product Manager",
        status: "interviewing",
      },
    ];

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const interviews = [
      {
        id: "int-1",
        application_id: "app-1",
        stage_type: "technical",
        scheduled_at: pastDate,
        outcome: "scheduled",
      },
    ];

    const items = evaluateAttentionItems(apps, interviews, [], []);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("outcome_needed");
    expect(items[0].title).toContain("Product Manager");
    expect(items[0].badgeLabel).toBe("Outcome needed");
  });

  it("flags post-interview follow-up due after 2 days", () => {
    const apps = [
      {
        id: "app-1",
        company_name: "Canva",
        job_title: "Software Engineer",
        status: "interviewing",
      },
    ];

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const interviews = [
      {
        id: "int-1",
        application_id: "app-1",
        stage_type: "panel",
        scheduled_at: threeDaysAgo,
        outcome: "completed",
      },
    ];

    const items = evaluateAttentionItems(apps, interviews, [], []);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("followup_due");
    expect(items[0].actionLabel).toContain("Draft follow-up");
  });

  it("flags ad closing soon", () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const ads = [
      {
        job_title: "Data Engineer",
        company_name: "Coles",
        closes_at: tomorrow,
      },
    ];

    const items = evaluateAttentionItems([], [], [], ads);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("closing_soon");
    expect(items[0].title).toContain("Data Engineer");
    expect(items[0].actionLabel).toContain("Review & apply");
  });

  it("returns empty array if no attention items exist", () => {
    const items = evaluateAttentionItems([], [], [], []);
    expect(items).toHaveLength(0);
  });
});
