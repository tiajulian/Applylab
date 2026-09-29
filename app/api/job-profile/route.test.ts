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
    db: null as unknown as ReturnType<typeof import("@/lib/jobs/testing/fakeSupabase").fakeSupabase>,
  };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({}), createServiceRoleClient: () => mocks.db.client }));
vi.mock("@/lib/aiGateway/embeddings", () => ({ embedUserText: mocks.embedUserText }));
vi.mock("@/lib/rateLimit", () => ({ checkAndRecordRateLimit: mocks.rateLimit }));
vi.mock("@/lib/jobs/matching/match", () => ({ refreshUserMatches: mocks.refreshUserMatches }));

const body = { targetTitles: ["Chef"], skills: ["Pastry"], locations: ["Perth"] };
const put = (payload: unknown) =>
  new Request("http://localhost/api/job-profile", { method: "PUT", body: JSON.stringify(payload) });

async function load() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.db = fakeSupabase();
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "free" } });
  mocks.rateLimit.mockResolvedValue(true);
  mocks.embedUserText.mockResolvedValue([0.1, 0.2]);
  mocks.refreshUserMatches.mockResolvedValue([{}, {}]);
});

describe("GET /api/job-profile", () => {
  it("401s without a user", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const { GET } = await load();
    expect((await GET()).status).toBe(401);
  });

  it("prefills defaults from the user's main profile when none is saved", async () => {
    mocks.db = fakeSupabase({ user_profiles: [{ data: { skills: ["SQL"], location: "Hobart" } }] });
    const { GET } = await load();
    const json = await (await GET()).json();
    expect(json).toMatchObject({ exists: false, profile: { skills: ["SQL"], locations: ["Hobart"], targetTitles: [] } });
    expect(mocks.db.eqValues("job_profiles", "user_id")).toEqual(["u1"]);
    expect(mocks.db.eqValues("user_profiles", "user_id")).toEqual(["u1"]);
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

  it("embeds a new profile, saves it for the current user and recomputes matches", async () => {
    mocks.db = fakeSupabase({ job_profiles: [{ data: null }, { data: { updated_at: "2026-09-30T01:00:00Z" } }] });
    const { PUT } = await load();
    const res = await PUT(put(body));

    expect(await res.json()).toMatchObject({ profile: { targetTitles: ["Chef"] }, matchCount: 2 });
    expect(mocks.embedUserText).toHaveBeenCalledWith(expect.stringContaining("Target roles: Chef"), expect.objectContaining({ userId: "u1", tier: "free" }));
    const upsert = mocks.db.calls.find((c) => c.table === "job_profiles" && c.method === "upsert")!;
    expect(upsert.args[0]).toMatchObject({ user_id: "u1", target_titles: ["Chef"], embedding: "[0.1,0.2]" });
    expect(mocks.refreshUserMatches).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", embedding: "[0.1,0.2]", updatedAt: "2026-09-30T01:00:00Z" }),
      expect.anything(),
      expect.anything()
    );
  });

  it("reuses the stored embedding when the profile text is unchanged", async () => {
    const { buildProfileText } = await import("@/lib/jobs/matching/text");
    const { validateProfileInput } = await import("@/lib/jobs/profile");
    const profileText = buildProfileText(validateProfileInput(body).input);
    mocks.db = fakeSupabase({
      job_profiles: [{ data: { profile_text: profileText, embedding: "[9]" } }, { data: { updated_at: "2026-09-30T01:00:00Z" } }],
    });

    const { PUT } = await load();
    await PUT(put({ ...body, minSalary: 80000 })); // salary isn't part of the embedded text

    expect(mocks.embedUserText).not.toHaveBeenCalled();
    expect(mocks.rateLimit).not.toHaveBeenCalled();
    expect(mocks.db.calls.find((c) => c.method === "upsert")!.args[0]).toMatchObject({ embedding: "[9]", min_salary: 80000 });
  });

  it("429s when re-embedding too often", async () => {
    mocks.rateLimit.mockResolvedValue(false);
    const { PUT } = await load();
    expect((await PUT(put(body))).status).toBe(429);
    expect(mocks.embedUserText).not.toHaveBeenCalled();
  });

  it("still succeeds when the match refresh fails", async () => {
    mocks.db = fakeSupabase({ job_profiles: [{ data: null }, { data: { updated_at: "2026-09-30T01:00:00Z" } }] });
    mocks.refreshUserMatches.mockRejectedValue(new Error("timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { PUT } = await load();
    const res = await PUT(put(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ matchCount: null });
  });
});
