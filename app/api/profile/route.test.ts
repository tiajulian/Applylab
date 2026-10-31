import { beforeEach, describe, expect, it, vi } from "vitest";

const { upsert, update, requireUser } = vi.hoisted(() => ({
  upsert: vi.fn(),
  update: vi.fn(),
  requireUser: vi.fn(),
}));
class UnauthorizedError extends Error {}
vi.mock("@/lib/requireUser", () => ({ requireUser, UnauthorizedError }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    from: (table: string) => table === "user_profiles"
      ? { upsert: (...args: unknown[]) => { upsert(...args); return { select: () => ({ single: async () => ({ data: args[0], error: null }) }) }; } }
      : { update: (...args: unknown[]) => { update(...args); return { eq: async () => ({ error: null }) }; } },
  }),
}));
const { POST } = await import("./route");
const request = (body: unknown) => new Request("http://localhost/api/profile", { method: "POST", body: JSON.stringify(body) });

describe("POST /api/profile contact links", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUser.mockResolvedValue({ authUserId: "owner", appUser: { full_name: "Sam" } });
  });

  it("saves intact URLs to the authenticated user's profile", async () => {
    const portfolio = `https://sam.dev/work?filter=${"a".repeat(600)}#projects`;
    const response = await POST(request({ user_id: "someone-else", portfolio_url: ` ${portfolio} `, github_url: " github.com/sam " }));
    expect(response.status).toBe(200);
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "owner", portfolio_url: portfolio, github_url: "github.com/sam" });
  });

  it("does not overwrite links omitted by older clients or incremental saves", async () => {
    expect((await POST(request({ fullName: "Sam" }))).status).toBe(200);
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("portfolio_url");
    expect(upsert.mock.calls[0][0]).not.toHaveProperty("github_url");
  });

  it("allows users to clear either link explicitly", async () => {
    expect((await POST(request({ portfolio_url: "  ", github_url: null }))).status).toBe(200);
    expect(upsert.mock.calls[0][0]).toMatchObject({ portfolio_url: "", github_url: "" });
  });

  it.each(["javascript:alert(1)", "not a link", `https://sam.dev/${"x".repeat(2000)}`, 42, {}])("rejects invalid links before writing: %s", async (value) => {
    const response = await POST(request({ portfolio_url: value }));
    expect(response.status).toBe(400);
    expect((await response.json()).field).toBe("portfolio_url");
    expect(upsert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects invalid GitHub links before writing", async () => {
    expect((await POST(request({ github_url: "data:text/html,hello" }))).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("requires authentication before accepting any changes", async () => {
    requireUser.mockRejectedValue(new UnauthorizedError());
    expect((await POST(request({ portfolio_url: "sam.dev" }))).status).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });
});
