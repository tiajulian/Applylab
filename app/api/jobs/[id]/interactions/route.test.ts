import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeSupabase } from "@/lib/jobs/testing/fakeSupabase";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    UnauthorizedError,
    requireUser: vi.fn(),
    db: null as unknown as ReturnType<typeof import("@/lib/jobs/testing/fakeSupabase").fakeSupabase>,
  };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => mocks.db.client }));

const JOB_ID = "11111111-2222-3333-4444-555555555555";
const post = (payload: unknown) =>
  new Request(`http://localhost/api/jobs/${JOB_ID}/interactions`, { method: "POST", body: JSON.stringify(payload) });
const del = () => new Request(`http://localhost/api/jobs/${JOB_ID}/interactions/saved`, { method: "DELETE" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mocks.db = fakeSupabase({ adzuna_jobs: [{ data: { id: JOB_ID } }] });
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1" } });
});

describe("POST /api/jobs/:id/interactions", () => {
  it("401s without a user", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const { POST } = await import("./route");
    expect((await POST(post({ action: "saved" }), { params: { id: JOB_ID } })).status).toBe(401);
  });

  it("400s on an unknown action with the field error shape", async () => {
    const { POST } = await import("./route");
    const res = await POST(post({ action: "liked" }), { params: { id: JOB_ID } });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Invalid interaction", fields: { action: expect.any(String) } });
  });

  it("404s for a malformed or unknown job id", async () => {
    const { POST } = await import("./route");
    expect((await POST(post({ action: "saved" }), { params: { id: "nope" } })).status).toBe(404);
    mocks.db = fakeSupabase({ adzuna_jobs: [{ data: null }] });
    expect((await POST(post({ action: "saved" }), { params: { id: JOB_ID } })).status).toBe(404);
  });

  it.each(["saved", "dismissed", "applied_click"])("records %s for the current user only", async (action) => {
    const { POST } = await import("./route");
    const res = await POST(post({ action }), { params: { id: JOB_ID } });
    expect(await res.json()).toEqual({ ok: true });
    const upsert = mocks.db.calls.find((c) => c.method === "upsert")!;
    expect(upsert.table).toBe("job_interactions");
    expect(upsert.args).toEqual([{ user_id: "u1", job_id: JOB_ID, action }, { onConflict: "user_id,job_id,action", ignoreDuplicates: true }]);
  });
});

describe("DELETE /api/jobs/:id/interactions/:action", () => {
  it("only undoes saved or dismissed", async () => {
    const { DELETE } = await import("./[action]/route");
    const res = await DELETE(del(), { params: { id: JOB_ID, action: "applied_click" } });
    expect(res.status).toBe(400);
    expect(mocks.db.calls).toHaveLength(0);
  });

  it("deletes only the current user's row", async () => {
    const { DELETE } = await import("./[action]/route");
    const res = await DELETE(del(), { params: { id: JOB_ID, action: "saved" } });
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.db.eqValues("job_interactions", "user_id")).toEqual(["u1"]);
    expect(mocks.db.eqValues("job_interactions", "job_id")).toEqual([JOB_ID]);
    expect(mocks.db.eqValues("job_interactions", "action")).toEqual(["saved"]);
  });
});
