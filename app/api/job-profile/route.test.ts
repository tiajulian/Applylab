import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/jobs/testing/fakeSupabase";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    UnauthorizedError,
    requireUser: vi.fn(),
    embedUserText: vi.fn(),
    rateLimit: vi.fn(),
    refreshUserMatches: vi.fn(),
    ingestJobsForTitles: vi.fn(),
    db: null as unknown as ReturnType<typeof import("@/lib/jobs/testing/fakeSupabase").fakeSupabase>,
  };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({}), createServiceRoleClient: () => mocks.db.client }));
vi.mock("@/lib/aiGateway/embeddings", () => ({ embedUserText: mocks.embedUserText }));
vi.mock("@/lib/rateLimit", () => ({ checkAndRecordRateLimit: mocks.rateLimit }));
vi.mock("@/lib/jobs/matching/match", () => ({ refreshUserMatches: mocks.refreshUserMatches }));
vi.mock("@/lib/jobs/ingestion", () => ({ ingestJobsForTitles: mocks.ingestJobsForTitles }));

const body = { targetTitles: ["Chef"], skills: ["Pastry"], locations: ["Perth"] };
const saved = { target_titles: ["Chef"], skills: ["Pastry"], locations: ["Perth"], embedding: "[0.1,0.2]", updated_at: "2026-09-30T01:00:00Z", is_auto: false };
const put = (payload: unknown) => new Request("http://localhost/api/job-profile", { method: "PUT", body: JSON.stringify(payload) });

async function load() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db = fakeSupabase({ job_profiles: [{ data: null }, { data: saved }] });
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "free" } });
  mocks.rateLimit.mockResolvedValue(true);
  mocks.embedUserText.mockResolvedValue([0.1, 0.2]);
  mocks.refreshUserMatches.mockResolvedValue([{}, {}]);
  mocks.ingestJobsForTitles.mockResolvedValue(0);
});

describe("GET /api/job-profile", () => {
  it("401s without a user", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const { GET } = await load();
    expect((await GET()).status).toBe(401);
  });

  it("previews the automatic profile built from the user's own data", async () => {
    mocks.db = fakeSupabase({
      job_profiles: [{ data: null }],
      user_profiles: [{ data: { skills: ["SQL"], location: "Hobart TAS", work_experience: [] } }],
      resumes: [{ data: [{ job_title: "Data Analyst" }] }],
      applications: [{ data: [] }],
    });
    const { GET } = await load();
    const json = await (await GET()).json();
    expect(json).toMatchObject({ exists: false, isAuto: true, profile: { targetTitles: ["Data Analyst"], skills: ["SQL"], locations: ["Hobart"] } });
    for (const table of ["job_profiles", "user_profiles", "resumes", "applications"]) {
      expect(mocks.db.eqValues(table, "user_id")).toEqual(["u1"]);
    }
  });

  it("returns a saved profile with its mode", async () => {
    mocks.db = fakeSupabase({ job_profiles: [{ data: { ...saved, contract_types: [], remote_ok: false, min_salary: null, seniority: null, resume_text: null } }] });
    const { GET } = await load();
    expect(await (await GET()).json()).toMatchObject({ exists: true, isAuto: false, profile: { targetTitles: ["Chef"] } });
  });
});

describe("PUT /api/job-profile", () => {
  it("400s with field errors", async () => {
    const { PUT } = await load();
    const res = await PUT(put({ targetTitles: [], seniority: "wizard" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid job profile", fields: { targetTitles: expect.any(String), seniority: expect.any(String) } });
    expect(mocks.embedUserText).not.toHaveBeenCalled();
  });

  it("saves a customised profile for the current user and recomputes matches", async () => {
    const { PUT } = await load();
    const res = await PUT(put(body));

    expect(await res.json()).toMatchObject({ profile: { targetTitles: ["Chef"] }, matchCount: 2 });
    expect(mocks.embedUserText).toHaveBeenCalledWith(expect.stringContaining("Target roles: Chef"), expect.objectContaining({ userId: "u1", tier: "free" }));
    const upsert = mocks.db.calls.find((c) => c.table === "job_profiles" && c.method === "upsert")!;
    expect(upsert.args[0]).toMatchObject({ user_id: "u1", target_titles: ["Chef"], embedding: "[0.1,0.2]", is_auto: false });
    expect(mocks.refreshUserMatches).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", embedding: "[0.1,0.2]", updatedAt: "2026-09-30T01:00:00Z" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("keeps QuickStart's starter titles automatic", async () => {
    const { PUT } = await load();
    await PUT(put({ ...body, automatic: true }));
    expect(mocks.db.calls.find((c) => c.method === "upsert")!.args).toEqual([
      expect.objectContaining({ user_id: "u1", is_auto: true }),
      { onConflict: "user_id", ignoreDuplicates: true },
    ]);
  });

  it("reuses the stored embedding when the profile text is unchanged", async () => {
    const { buildProfileText } = await import("@/lib/jobs/matching/text");
    const { validateProfileInput } = await import("@/lib/jobs/profile");
    const profileText = buildProfileText(validateProfileInput(body).input);
    mocks.db = fakeSupabase({ job_profiles: [{ data: { profile_text: profileText, embedding: "[9]", target_titles: ["Chef"], locations: ["Perth"] } }, { data: saved }] });

    const { PUT } = await load();
    await PUT(put({ ...body, minSalary: 80000 })); // salary isn't part of the embedded text

    expect(mocks.embedUserText).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.ingestJobsForTitles).not.toHaveBeenCalled();
    expect(mocks.db.calls.find((c) => c.method === "upsert")!.args[0]).toMatchObject({ embedding: "[9]", min_salary: 80000 });
  });

  it("429s when re-embedding too often", async () => {
    mocks.rateLimit.mockResolvedValue(false);
    const { PUT } = await load();
    expect((await PUT(put(body))).status).toBe(429);
    expect(mocks.embedUserText).not.toHaveBeenCalled();
  });

  it("fetches jobs for newly added titles before matching", async () => {
    mocks.db = fakeSupabase({ job_profiles: [{ data: { ...saved, profile_text: "old", target_titles: ["chef"] } }, { data: saved }] });
    const { PUT } = await load();
    await PUT(put({ ...body, targetTitles: ["Chef", "Analytics Engineer"] }));

    expect(mocks.ingestJobsForTitles).toHaveBeenCalledWith(["Analytics Engineer"], expect.any(Function));
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), "job-fetch:u1", 10, 86_400_000);
    expect(mocks.ingestJobsForTitles.mock.invocationCallOrder[0]).toBeLessThan(mocks.refreshUserMatches.mock.invocationCallOrder[0]);
  });

  it("fetches only the titles within the user's daily allowance", async () => {
    mocks.db = fakeSupabase({ job_profiles: [{ data: { ...saved, profile_text: "old", target_titles: [] } }, { data: saved }] });
    // First call is the embed limit, then one allowed title fetch, then the allowance runs out.
    mocks.rateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    const { PUT } = await load();
    await PUT(put({ ...body, targetTitles: ["Chef", "Baker", "Barista"] }));
    expect(mocks.ingestJobsForTitles).toHaveBeenCalledWith(["Chef"], expect.any(Function));
  });

  it("still saves and matches when the job fetch fails", async () => {
    mocks.ingestJobsForTitles.mockRejectedValue(new Error("Adzuna down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { PUT } = await load();
    const res = await PUT(put(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ matchCount: 2 });
  });

  it("still succeeds when the match refresh fails", async () => {
    mocks.refreshUserMatches.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { PUT } = await load();
    const res = await PUT(put(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ matchCount: null });
  });
});

describe("DELETE /api/job-profile", () => {
  it("removes only the current user's customised profile", async () => {
    const { DELETE } = await load();
    expect(await (await DELETE()).json()).toEqual({ ok: true });
    expect(mocks.db.calls.some((c) => c.table === "job_profiles" && c.method === "delete")).toBe(true);
    expect(mocks.db.eqValues("job_profiles", "user_id")).toEqual(["u1"]);
  });
});
