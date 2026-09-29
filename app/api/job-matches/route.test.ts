import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return { UnauthorizedError, requireUser: vi.fn(), ensureFreshMatches: vi.fn(), getMatchesPage: vi.fn() };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));
vi.mock("@/lib/supabase/server", () => ({ createServiceRoleClient: () => ({}) }));
vi.mock("@/lib/jobs/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/service")>()),
  ensureFreshMatches: mocks.ensureFreshMatches,
  getMatchesPage: mocks.getMatchesPage,
}));

const get = (qs = "") => new Request(`http://localhost/api/job-matches${qs}`);

async function load() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1" } });
  mocks.ensureFreshMatches.mockResolvedValue(true);
  mocks.getMatchesPage.mockResolvedValue({ matches: [{ score: 87 }], total: 1 });
});

describe("GET /api/job-matches", () => {
  it("401s without a user", async () => {
    mocks.requireUser.mockRejectedValue(new mocks.UnauthorizedError());
    const { GET } = await load();
    expect((await GET(get())).status).toBe(401);
  });

  it("400s on an invalid query", async () => {
    const { GET } = await load();
    const res = await GET(get("?limit=500"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid match query" });
  });

  it("reports a missing profile instead of an empty list", async () => {
    mocks.ensureFreshMatches.mockResolvedValue(false);
    const { GET } = await load();
    expect(await (await GET(get())).json()).toEqual({ hasProfile: false, matches: [], total: 0, page: 1, limit: 20 });
    expect(mocks.getMatchesPage).not.toHaveBeenCalled();
  });

  it("returns the current user's page", async () => {
    const { GET } = await load();
    const json = await (await GET(get("?page=2&limit=10&sort=newest"))).json();
    expect(json).toEqual({ hasProfile: true, matches: [{ score: 87 }], total: 1, page: 2, limit: 10 });
    expect(mocks.ensureFreshMatches).toHaveBeenCalledWith(expect.anything(), "u1");
    expect(mocks.getMatchesPage).toHaveBeenCalledWith(expect.anything(), "u1", expect.objectContaining({ page: 2, limit: 10, sort: "newest" }));
  });
});
