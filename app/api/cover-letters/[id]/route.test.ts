import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    UnauthorizedError,
    requireUser: vi.fn(),
    /** Results for successive `from()` calls: the fetch of the current row, then the update. */
    results: [] as unknown[],
    updateSpy: vi.fn(),
  };
});

vi.mock("@/lib/requireUser", () => ({ requireUser: mocks.requireUser, UnauthorizedError: mocks.UnauthorizedError }));

function chain(result: unknown) {
  const node: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is"]) node[method] = () => node;
  node.update = (values: unknown) => {
    mocks.updateSpy(values);
    return node;
  };
  node.maybeSingle = () => Promise.resolve(result);
  return node;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: () => chain(mocks.results.shift() ?? { data: null }) }),
}));

const CURRENT = { id: "cl-1", updated_at: "2026-09-21T00:00:00.000Z", content: { contact: { name: "Sam" }, body: "old" } };
const params = { params: { id: "cl-1" } };

function patch(body: unknown) {
  return new Request("http://localhost/api/cover-letters/cl-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function load() {
  vi.resetModules();
  vi.stubEnv("NEXT_PUBLIC_COVER_LETTER_V1", "true");
  return import("./route");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.results = [];
  mocks.requireUser.mockResolvedValue({ authUserId: "u1", appUser: { id: "u1", plan: "free" } });
});

describe("PATCH /api/cover-letters/:id", () => {
  it("400s when there is nothing to update or the title is empty", async () => {
    const { PATCH } = await load();
    expect((await PATCH(patch({}), params)).status).toBe(400);
    expect((await PATCH(patch({ title: "  " }), params)).status).toBe(400);
  });

  it("404s for a letter that is not the user's", async () => {
    mocks.results = [{ data: null }];
    const { PATCH } = await load();
    expect((await PATCH(patch({ body: "x" }), params)).status).toBe(404);
  });

  it("409s without writing when another tab has saved since", async () => {
    mocks.results = [{ data: CURRENT }];
    const { PATCH } = await load();
    const res = await PATCH(patch({ body: "new", expectedUpdatedAt: "2026-09-20T00:00:00.000Z" }), params);
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe("CONFLICT");
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it("409s when the atomic update matches no row (lost a race)", async () => {
    mocks.results = [{ data: CURRENT }, { data: null, error: null }];
    const { PATCH } = await load();
    expect((await PATCH(patch({ body: "new", expectedUpdatedAt: CURRENT.updated_at }), params)).status).toBe(409);
  });

  it("saves, keeps the copied contact, recounts words and returns the new version", async () => {
    mocks.results = [{ data: CURRENT }, { data: { updated_at: "2026-09-21T00:01:00.000Z" }, error: null }];
    const { PATCH } = await load();
    const res = await PATCH(patch({ body: "one two three", expectedUpdatedAt: CURRENT.updated_at }), params);
    expect(res.status).toBe(200);
    expect((await res.json()).updatedAt).toBe("2026-09-21T00:01:00.000Z");
    expect(mocks.updateSpy.mock.calls[0][0]).toMatchObject({
      content: { contact: { name: "Sam" }, body: "one two three" },
      word_count: 3,
    });
  });
});

describe("DELETE /api/cover-letters/:id", () => {
  it("soft-deletes by setting deleted_at", async () => {
    mocks.results = [{ data: { id: "cl-1" }, error: null }];
    const { DELETE } = await load();
    const res = await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params);
    expect(res.status).toBe(200);
    expect(mocks.updateSpy.mock.calls[0][0]).toHaveProperty("deleted_at");
  });

  it("404s when there is nothing to delete", async () => {
    mocks.results = [{ data: null, error: null }];
    const { DELETE } = await load();
    expect((await DELETE(new Request("http://localhost/x", { method: "DELETE" }), params)).status).toBe(404);
  });
});
