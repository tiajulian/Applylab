import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase } from "@/lib/jobs/testing/fakeSupabase";

const refreshUserMatches = vi.hoisted(() => vi.fn());
vi.mock("@/lib/jobs/matching/match", () => ({ refreshUserMatches }));

const { ensureFreshMatches, getMatchesPage } = await import("@/lib/jobs/service");

const profileRow = {
  target_titles: ["Chef"],
  skills: [],
  locations: ["Perth"],
  remote_ok: false,
  min_salary: null,
  contract_types: [],
  seniority: null,
  resume_text: null,
  profile_text: "x",
  embedding: "[0.1]",
  updated_at: "2026-09-30T10:00:00Z",
  matches_computed_at: null as string | null,
};

function db(opts: { profile?: object | null; runStartedAt?: string | null; computedAt?: string | null }) {
  const profile = opts.profile === undefined ? { ...profileRow, matches_computed_at: opts.computedAt ?? null } : opts.profile;
  return fakeSupabase({
    job_profiles: [{ data: profile }],
    adzuna_ingest_runs: [{ data: opts.runStartedAt ? { started_at: opts.runStartedAt } : null }],
  });
}

const run = (fake: ReturnType<typeof fakeSupabase>) => ensureFreshMatches(fake.client as unknown as SupabaseClient, "u1");

beforeEach(() => refreshUserMatches.mockReset().mockResolvedValue([]));

describe("ensureFreshMatches", () => {
  it("returns false without a profile or embedding, and computes nothing", async () => {
    await expect(run(db({ profile: null }))).resolves.toBe(false);
    await expect(run(db({ profile: { ...profileRow, embedding: null } }))).resolves.toBe(false);
    expect(refreshUserMatches).not.toHaveBeenCalled();
  });

  it("serves the cache when computed after the profile save and the last run started", async () => {
    await expect(run(db({ runStartedAt: "2026-09-30T09:00:00Z", computedAt: "2026-09-30T11:00:00Z" }))).resolves.toBe(true);
    expect(refreshUserMatches).not.toHaveBeenCalled();
  });

  it("does not recompute a fresh cache that holds zero matches", async () => {
    // Freshness is read from the profile, not from match rows, so an empty result still counts.
    await expect(run(db({ runStartedAt: null, computedAt: "2026-09-30T11:00:00Z" }))).resolves.toBe(true);
    expect(refreshUserMatches).not.toHaveBeenCalled();
  });

  it.each([
    ["no cache yet", { runStartedAt: "2026-09-30T09:00:00Z", computedAt: null }],
    ["profile saved after the cache", { runStartedAt: null, computedAt: "2026-09-30T09:59:00Z" }],
    ["a newer ingestion run", { runStartedAt: "2026-09-30T12:00:00Z", computedAt: "2026-09-30T11:00:00Z" }],
  ])("recomputes when stale: %s", async (_label, opts) => {
    await expect(run(db(opts))).resolves.toBe(true);
    expect(refreshUserMatches).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", embedding: "[0.1]", targetTitles: ["Chef"], updatedAt: "2026-09-30T10:00:00Z" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("scopes every lookup to the user", async () => {
    const fake = db({ runStartedAt: null, computedAt: "2026-09-30T11:00:00Z" });
    await run(fake);
    expect(fake.eqValues("job_profiles", "user_id")).toEqual(["u1"]);
  });
});

describe("getMatchesPage", () => {
  const query = { page: 3, limit: 5, sort: "score" as const, location: null, minSalary: null, contractTypes: [], maxAgeDays: null };

  it("still reports the real total on a page past the end", async () => {
    const fake = fakeSupabase({ "rpc:job_matches_page": [{ data: [] }, { data: [{ total: 7 }] }] });
    const page = await getMatchesPage(fake.client as unknown as SupabaseClient, "u1", query);
    expect(page).toEqual({ total: 7, matches: [] });
    expect(fake.calls[1].args[0]).toMatchObject({ p_limit: 1, p_offset: 0 });
  });

  it("maps rows to the API shape with a 0-100 score", async () => {
    const fake = fakeSupabase({
      "rpc:job_matches_page": [
        {
          data: [
            {
              job_id: "j1",
              score: 0.874,
              reasons: ["Posted today"],
              saved: true,
              total: 12,
              title: "Chef",
              company: null,
              location_display: "Perth",
              salary_min: null,
              salary_max: null,
              salary_is_predicted: false,
              contract_type: null,
              contract_time: null,
              description_snippet: "",
              posted_at: null,
              redirect_url: "https://www.adzuna.com.au/land/ad/1",
              source: "adzuna",
            },
          ],
        },
      ],
    });
    const page = await getMatchesPage(fake.client as unknown as SupabaseClient, "u1", {
      page: 3,
      limit: 5,
      sort: "score",
      location: null,
      minSalary: null,
      contractTypes: [],
      maxAgeDays: null,
    });

    expect(page).toEqual({
      total: 12,
      matches: [{ job: expect.objectContaining({ id: "j1", applyUrl: "https://www.adzuna.com.au/land/ad/1" }), score: 87, reasons: ["Posted today"], saved: true }],
    });
    expect(fake.calls[0].args[0]).toMatchObject({ p_user_id: "u1", p_limit: 5, p_offset: 10 });
  });
});
