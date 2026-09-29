import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fakeSupabase } from "@/lib/jobs/testing/fakeSupabase";

const mocks = vi.hoisted(() => ({
  refreshUserMatches: vi.fn(),
  deriveJobProfile: vi.fn(),
  embedUserText: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/jobs/matching/match", () => ({ refreshUserMatches: mocks.refreshUserMatches }));
vi.mock("@/lib/jobs/autoProfile", () => ({ deriveJobProfile: mocks.deriveJobProfile }));
vi.mock("@/lib/aiGateway/embeddings", () => ({ embedUserText: mocks.embedUserText }));
vi.mock("@/lib/rateLimit", () => ({ checkAndRecordRateLimit: mocks.rateLimit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({}) }));

const { ensureFreshMatches, ensureJobProfile, getMatchesPage } = await import("@/lib/jobs/service");
const { buildProfileText } = await import("@/lib/jobs/matching/text");
const { EMPTY_PROFILE } = await import("@/lib/jobs/profile");

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
  is_auto: true,
};

const client = (fake: ReturnType<typeof fakeSupabase>) => fake.client as unknown as SupabaseClient;

function runFresh(opts: { runStartedAt?: string | null; computedAt?: string | null }) {
  const fake = fakeSupabase({ adzuna_ingest_runs: [{ data: opts.runStartedAt ? { started_at: opts.runStartedAt } : null }] });
  return ensureFreshMatches(client(fake), "u1", { ...profileRow, matches_computed_at: opts.computedAt ?? null });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.refreshUserMatches.mockResolvedValue([]);
  mocks.rateLimit.mockResolvedValue(true);
  mocks.embedUserText.mockResolvedValue([0.5]);
});

describe("ensureFreshMatches", () => {
  it("serves the cache when computed after the profile save and the last run started", async () => {
    await runFresh({ runStartedAt: "2026-09-30T09:00:00Z", computedAt: "2026-09-30T11:00:00Z" });
    expect(mocks.refreshUserMatches).not.toHaveBeenCalled();
  });

  it("does not recompute a fresh cache that holds zero matches", async () => {
    // Freshness is read from the profile, not from match rows, so an empty result still counts.
    await runFresh({ runStartedAt: null, computedAt: "2026-09-30T11:00:00Z" });
    expect(mocks.refreshUserMatches).not.toHaveBeenCalled();
  });

  it.each([
    ["no cache yet", { runStartedAt: "2026-09-30T09:00:00Z", computedAt: null }],
    ["profile saved after the cache", { runStartedAt: null, computedAt: "2026-09-30T09:59:00Z" }],
    ["a newer ingestion run", { runStartedAt: "2026-09-30T12:00:00Z", computedAt: "2026-09-30T11:00:00Z" }],
  ])("recomputes when stale: %s", async (_label, opts) => {
    await runFresh(opts);
    expect(mocks.refreshUserMatches).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", embedding: "[0.1]", targetTitles: ["Chef"], updatedAt: "2026-09-30T10:00:00Z" }),
      expect.anything(),
      expect.anything()
    );
  });
});

describe("ensureJobProfile", () => {
  const user = { id: "u1", tier: "free" as const };
  const derived = { ...EMPTY_PROFILE, targetTitles: ["Baker"], skills: ["Pastry"] };

  it("never touches a customised profile", async () => {
    const custom = { ...profileRow, is_auto: false };
    const fake = fakeSupabase({ job_profiles: [{ data: custom }] });
    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(custom);
    expect(mocks.deriveJobProfile).not.toHaveBeenCalled();
  });

  it("builds and saves an automatic profile on first use", async () => {
    mocks.deriveJobProfile.mockResolvedValue(derived);
    const saved = { ...profileRow, target_titles: ["Baker"], embedding: "[0.5]" };
    const fake = fakeSupabase({ job_profiles: [{ data: null }, { data: saved }] });

    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(saved);
    expect(mocks.embedUserText).toHaveBeenCalledWith(buildProfileText(derived), expect.objectContaining({ userId: "u1" }));
    const upsert = fake.calls.find((c) => c.method === "upsert")!;
    expect(upsert.args[0]).toMatchObject({ user_id: "u1", target_titles: ["Baker"], embedding: "[0.5]", is_auto: true });
  });

  it("refreshes an automatic profile only if nobody changed it since it was read", async () => {
    mocks.deriveJobProfile.mockResolvedValue(derived);
    const rebuilt = { ...profileRow, target_titles: ["Baker"] };
    const fake = fakeSupabase({ job_profiles: [{ data: profileRow }, { data: rebuilt }] });

    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(rebuilt);
    expect(fake.calls.some((c) => c.method === "update")).toBe(true);
    expect(fake.eqValues("job_profiles", "is_auto")).toEqual([true]);
    expect(fake.eqValues("job_profiles", "updated_at")).toEqual([profileRow.updated_at]);
  });

  it("serves the customisation saved meanwhile when the guarded rebuild loses the race", async () => {
    mocks.deriveJobProfile.mockResolvedValue(derived);
    const custom = { ...profileRow, is_auto: false, target_titles: ["Pilot"] };
    // read -> guarded update matches nothing -> re-read finds the user's custom profile
    const fake = fakeSupabase({ job_profiles: [{ data: profileRow }, { data: null }, { data: custom }] });
    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(custom);
  });

  it("keeps the previous profile when the AI call fails", async () => {
    mocks.deriveJobProfile.mockResolvedValue(derived);
    mocks.embedUserText.mockRejectedValue(new Error("AI unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fake = fakeSupabase({ job_profiles: [{ data: profileRow }] });
    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(profileRow);
  });

  it("returns the automatic profile untouched when the user's data hasn't changed", async () => {
    mocks.deriveJobProfile.mockResolvedValue(derived);
    const current = { ...profileRow, profile_text: buildProfileText(derived) };
    const fake = fakeSupabase({ job_profiles: [{ data: current }] });

    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(current);
    expect(fake.calls.some((c) => c.method === "upsert")).toBe(false);
    expect(mocks.embedUserText).not.toHaveBeenCalled();
  });

  it("returns null when there is nothing to build from", async () => {
    mocks.deriveJobProfile.mockResolvedValue(null);
    const fake = fakeSupabase({ job_profiles: [{ data: null }] });
    await expect(ensureJobProfile(client(fake), user)).resolves.toBeNull();
  });

  it("keeps the previous automatic profile when over the embedding limit", async () => {
    mocks.deriveJobProfile.mockResolvedValue(derived);
    mocks.rateLimit.mockResolvedValue(false);
    const fake = fakeSupabase({ job_profiles: [{ data: profileRow }] });
    await expect(ensureJobProfile(client(fake), user)).resolves.toBe(profileRow);
    expect(mocks.embedUserText).not.toHaveBeenCalled();
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
