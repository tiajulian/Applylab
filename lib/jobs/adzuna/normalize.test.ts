import { describe, expect, it } from "vitest";
import fixture from "@/lib/jobs/__fixtures__/adzunaSearch.json";
import { contentHash, mapAdzunaJob, stripHtml, toAnnualSalary } from "@/lib/jobs/adzuna/normalize";
import type { AdzunaJobResult } from "@/lib/jobs/adzuna/types";

const [full, sparse, broken] = fixture.results as AdzunaJobResult[];

describe("mapAdzunaJob", () => {
  it("maps a full fixture result", () => {
    expect(mapAdzunaJob(full)).toEqual({
      source: "adzuna",
      external_id: "4812345678",
      title: "Senior Frontend Developer",
      company: "Acme Pty Ltd",
      description_snippet: "We are looking for a React & TypeScript developer to join our team in Sydney…",
      location_display: "Sydney, New South Wales",
      location_area: ["Australia", "New South Wales", "Sydney"],
      lat: -33.8688,
      lng: 151.2093,
      category_tag: "it-jobs",
      category_label: "IT Jobs",
      salary_min: 110000,
      salary_max: 130000,
      salary_is_predicted: false,
      contract_type: "permanent",
      contract_time: "full_time",
      redirect_url: full.redirect_url,
      posted_at: "2026-09-26T03:00:00.000Z",
      content_hash: contentHash(
        "Senior Frontend Developer",
        "Acme Pty Ltd",
        "We are looking for a React & TypeScript developer to join our team in Sydney…"
      ),
    });
  });

  it("keeps redirect_url exactly as returned, tracking params included", () => {
    expect(mapAdzunaJob(full)?.redirect_url).toBe(
      "https://www.adzuna.com.au/land/ad/4812345678?se=abc&utm_medium=api&utm_source=12345&v=DEF"
    );
  });

  it("handles missing optional fields and a numeric id", () => {
    const row = mapAdzunaJob(sparse)!;
    expect(row.external_id).toBe("4812345679");
    expect(row.company).toBeNull();
    expect(row.location_area).toEqual([]);
    expect(row.lat).toBeNull();
    expect(row.category_tag).toBeNull();
    expect(row.contract_type).toBeNull();
    expect(row.salary_is_predicted).toBe(true);
  });

  it("converts hourly-looking salaries to annual AUD", () => {
    const row = mapAdzunaJob(sparse)!;
    expect(row.salary_min).toBe(89_908); // 45.5 * 1976
    expect(toAnnualSalary(0)).toBeNull();
    expect(toAnnualSalary(undefined)).toBeNull();
    expect(toAnnualSalary(95_000.4)).toBe(95_000);
  });

  it("skips results without an id, title or redirect_url", () => {
    expect(mapAdzunaJob(broken)).toBeNull();
    expect(mapAdzunaJob({})).toBeNull();
    expect(mapAdzunaJob({ id: "1", title: "<b></b>", redirect_url: "https://x" })).toBeNull();
  });

  it("changes the content hash only when title, company or snippet change", () => {
    const base = mapAdzunaJob(full)!;
    expect(mapAdzunaJob({ ...full, salary_max: 140000 })!.content_hash).toBe(base.content_hash);
    expect(mapAdzunaJob({ ...full, description: "New text" })!.content_hash).not.toBe(base.content_hash);
  });
});

describe("stripHtml", () => {
  it("removes tags, decodes entities and collapses whitespace", () => {
    expect(stripHtml("  <p>A&nbsp;&amp;&#39;B&#x27;</p>\n\n<br/>C ")).toBe("A &'B' C");
  });
});
