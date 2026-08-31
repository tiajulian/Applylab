import { describe, it, expect } from "vitest";
import {
  evaluateAttentionItems,
  getAttentionClosesAtBounds,
  getAttentionItems,
} from "@/lib/dashboard/attention";
import { getMelbourneDateString, diffCalendarDaysMelbourne } from "@/lib/dateUtils";

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
    expect(items[0].title).toContain("Panel interview with Macquarie Group");
    expect(items[0].actionLabel).toBe("Practise round →");
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
    expect(items[0].title).toContain("Technical interview with Atlassian took place");
    expect(items[0].actionLabel).toBe("Log outcome →");
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
    expect(items[0].title).toContain("days since Canva interview");
    expect(items[0].actionLabel).toBe("Draft follow-up →");
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
    expect(items[0].title).toContain("Coles application closes tomorrow");
    expect(items[0].actionLabel).toBe("Review & apply →");
  });

  it("returns empty array if no attention items exist", () => {
    const items = evaluateAttentionItems([], [], [], []);
    expect(items).toHaveLength(0);
  });
});

describe("Fix 4: ClosesAt boundary safety & pre-filter superset tests", () => {
  // Test 1: Job closing on the LAST in-window day, late in the day (today+2 at 23:00 Melbourne time)
  it("includes job closing on the last in-window day late in the day (today+2 at 23:00 Melbourne)", () => {
    const fixedNow = new Date("2026-08-31T10:00:00+10:00");
    // In Melbourne, today is 2026-08-31. Last in-window day (today+2) is 2026-09-02.
    // Closes at 23:00 Melbourne time on 2026-09-02:
    const lateClosingTimestamp = "2026-09-02T23:00:00+10:00";
    const ads = [
      {
        job_title: "Staff Engineer",
        company_name: "Telstra",
        closes_at: lateClosingTimestamp,
      },
    ];

    expect(diffCalendarDaysMelbourne(lateClosingTimestamp, fixedNow)).toBe(2);

    const items = evaluateAttentionItems([], [], [], ads, fixedNow);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("closing_soon");
    expect(items[0].companyName).toBe("Telstra");
    expect(items[0].badgeLabel).toBe("Closes soon");
    expect(items[0].title).toContain("Telstra application closes soon");
  });

  // Test 2: Job closing at Melbourne/UTC boundary (e.g. 00:30 Melbourne which is previous UTC date)
  it("correctly resolves job closing at Melbourne/UTC boundary (00:30 Melbourne time)", () => {
    // 2026-09-01T00:30:00+10:00 is 2026-08-31T14:30:00Z in UTC
    const boundaryTime = "2026-09-01T00:30:00+10:00";
    const fixedNow = new Date("2026-08-31T12:00:00+10:00"); // Melbourne today = 2026-08-31

    const daysUntil = diffCalendarDaysMelbourne(boundaryTime, fixedNow);
    expect(daysUntil).toBe(1);
    expect(getMelbourneDateString(boundaryTime)).toBe("2026-09-01");

    const ads = [
      {
        job_title: "Frontend Lead",
        company_name: "NAB",
        closes_at: boundaryTime,
      },
    ];
    const items = evaluateAttentionItems([], [], [], ads, fixedNow);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("closing_soon");
    expect(items[0].companyName).toBe("NAB");
    expect(items[0].badgeLabel).toBe("Closes soon");
    expect(items[0].title).toContain("NAB application closes tomorrow");
  });

  // Test 3: Just-outside negative controls (yesterday daysUntil = -1 and today+3 daysUntil = 3)
  it("excludes just-outside dates (yesterday and today+3) even when returned by widened DB pre-filter", () => {
    const todayStr = getMelbourneDateString();
    const msPerDay = 24 * 60 * 60 * 1000;
    const yesterdayStr = getMelbourneDateString(new Date(Date.now() - msPerDay));
    const threeDaysLaterStr = getMelbourneDateString(new Date(Date.now() + 3 * msPerDay));

    const candidateAds = [
      {
        job_title: "Expired Role",
        company_name: "Yesterday Corp",
        closes_at: yesterdayStr, // daysUntil = -1
      },
      {
        job_title: "Future Role",
        company_name: "Four Days Away Inc",
        closes_at: threeDaysLaterStr, // daysUntil = 3
      },
    ];

    const items = evaluateAttentionItems([], [], [], candidateAds);
    // Neither should appear in attention items because 0 <= daysUntil <= 2 rejects -1 and 3
    expect(items.find((i) => i.companyName === "Yesterday Corp")).toBeUndefined();
    expect(items.find((i) => i.companyName === "Four Days Away Inc")).toBeUndefined();
    expect(items).toHaveLength(0);
  });

  // Test 4: Existing in-window cases (today, today+1, today+2 midday) all appear
  it("includes all valid in-window dates (today, today+1, today+2)", () => {
    const msPerDay = 24 * 60 * 60 * 1000;
    const todayStr = getMelbourneDateString();
    const tomorrowStr = getMelbourneDateString(new Date(Date.now() + msPerDay));
    const dayAfterStr = getMelbourneDateString(new Date(Date.now() + 2 * msPerDay));

    const ads = [
      {
        job_title: "Role A",
        company_name: "Today Corp",
        closes_at: todayStr,
      },
      {
        job_title: "Role B",
        company_name: "Tomorrow Corp",
        closes_at: tomorrowStr,
      },
      {
        job_title: "Role C",
        company_name: "Day After Corp",
        closes_at: dayAfterStr,
      },
    ];

    const items = evaluateAttentionItems([], [], [], ads);
    expect(items).toHaveLength(3);
    const todayItem = items.find((i) => i.companyName === "Today Corp");
    const tomorrowItem = items.find((i) => i.companyName === "Tomorrow Corp");
    const dayAfterItem = items.find((i) => i.companyName === "Day After Corp");

    expect(todayItem?.badgeLabel).toBe("Closes today");
    expect(tomorrowItem?.badgeLabel).toBe("Closes soon");
    expect(dayAfterItem?.badgeLabel).toBe("Closes soon");
  });

  // Test 5: Verify getAttentionClosesAtBounds is a strict superset of the JS evaluation window
  it("getAttentionClosesAtBounds computes [today - 1, today + 3] which is a strict superset of [today, today + 2]", () => {
    const sampleDate = new Date("2026-08-31T12:00:00+10:00");
    const { minDate, maxDate } = getAttentionClosesAtBounds(sampleDate);

    expect(minDate).toBe("2026-08-30"); // today - 1 day
    expect(maxDate).toBe("2026-09-03"); // today + 3 days

    // The JS evaluation window is [2026-08-31, 2026-09-02] (3 calendar days: today, today+1, today+2)
    // The DB pre-filter window is [2026-08-30, 2026-09-03] (5 calendar days: today-1, today, today+1, today+2, today+3)
    expect(minDate < "2026-08-31").toBe(true);
    expect(maxDate > "2026-09-02").toBe(true);
  });

  // Test 6: getAttentionItems integration with mocked Supabase client
  it("getAttentionItems queries parsed_job_ads with the widened pre-filter bounds", async () => {
    const queriedFilters: Record<string, unknown> = {};

    const mockSupabase = {
      from: (table: string) => {
        const query: any = {
          select: () => query,
          eq: () => query,
          not: () => query,
          gte: (col: string, val: string) => {
            queriedFilters[`${table}.${col}.gte`] = val;
            return query;
          },
          lte: (col: string, val: string) => {
            queriedFilters[`${table}.${col}.lte`] = val;
            return query;
          },
          then: (resolve: (val: any) => void) => {
            if (table === "parsed_job_ads") {
              const msPerDay = 24 * 60 * 60 * 1000;
              // Return superset containing both in-window and padded boundary rows
              resolve({
                data: [
                  { title: "Role 1", company: "Company 1", closes_at: getMelbourneDateString(new Date(Date.now() - msPerDay)) }, // yesterday (padded)
                  { title: "Role 2", company: "Company 2", closes_at: getMelbourneDateString() }, // today (in-window)
                  { title: "Role 3", company: "Company 3", closes_at: getMelbourneDateString(new Date(Date.now() + 3 * msPerDay)) }, // today+3 (padded)
                ],
              });
            } else {
              resolve({ data: [] });
            }
          },
        };
        return query;
      },
    } as any;

    const items = await getAttentionItems(mockSupabase, "test-user-id");

    // Verify DB query applied the widened bounds
    expect(queriedFilters["parsed_job_ads.closes_at.gte"]).toBeDefined();
    expect(queriedFilters["parsed_job_ads.closes_at.lte"]).toBeDefined();

    // Verify JS trimmed the superset: Company 1 (yesterday) and Company 3 (today+3) were discarded, only Company 2 (today) survived
    expect(items).toHaveLength(1);
    expect(items[0].companyName).toBe("Company 2");
  });
});

