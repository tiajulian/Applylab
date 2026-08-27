import { describe, it, expect } from "vitest";
import { evaluateAttentionItems } from "@/lib/dashboard/attention";

describe("evaluateAttentionItems", () => {
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

  it("returns empty array if no attention items exist", () => {
    const items = evaluateAttentionItems([], [], [], []);
    expect(items).toHaveLength(0);
  });
});
