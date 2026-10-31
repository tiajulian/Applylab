import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ assist: vi.fn(), reserve: vi.fn(), single: vi.fn() }));
vi.mock("@/lib/aiGateway/errorResponse", () => ({ aiErrorResponse: () => null }));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/supabase/server", () => ({ createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) }) }));
vi.mock("@/lib/anthropic/assistBullet", () => ({ assistBullet: mocks.assist, AssistBulletError: class extends Error {} }));
vi.mock("@/lib/resume/parsedJobAdCache", () => ({ getOrParseCompactJobAd: async () => ({}) }));
vi.mock("@/lib/requireUser", () => ({
  requirePermanentUser: async () => ({ appUser: { id: "user-1", plan: "free" } }),
  reserveAssistCall: mocks.reserve,
  refundAssistCall: vi.fn(),
  AssistLimitReachedError: class extends Error {},
  UnauthorizedError: class extends Error {},
  unauthorizedResponse: vi.fn(),
}));
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.single.mockResolvedValue({ data: { id: "resume-1", job_description: "" }, error: null });
});
function request(outcome: string, metric = "") {
  return POST(new Request("http://localhost/api/resume/resume-1/assist", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bulletText: "Prepared reports", action: "quantify", outcome, metric }),
  }), { params: Promise.resolve({ id: "resume-1" }) });
}
it("passes confirmed outcomes through and rejects invented numbers without inserting placeholders", async () => {
  mocks.assist.mockResolvedValue(["Prepared reports for 3 teams", "Prepared reports for 99 teams"]);
  const response = await request("Used by 3 teams");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ options: ["Prepared reports for 3 teams"] });
  expect(mocks.assist).toHaveBeenCalledWith(expect.objectContaining({ outcome: "Used by 3 teams" }), "user-1", expect.anything(), "free");
});
it("accepts a no-number rewrite", async () => {
  mocks.assist.mockResolvedValue(["Prepared reports for weekly meetings"]);
  expect(await (await request("Used for weekly meetings")).json()).toEqual({ options: ["Prepared reports for weekly meetings"] });
});
it("rejects oversized answers before reserving an edit or calling AI", async () => {
  expect((await request("a".repeat(1001))).status).toBe(400);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.assist).not.toHaveBeenCalled();
});
