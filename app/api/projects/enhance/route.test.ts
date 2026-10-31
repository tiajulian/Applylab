import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), refund: vi.fn(), gateway: vi.fn(), single: vi.fn(), count: vi.fn(), rate: vi.fn(), auth: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/aiGateway/errorResponse", () => ({ aiErrorResponse: () => null }));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ single: mocks.single }) }) }) }),
  createServiceRoleClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ gte: mocks.count }) }) }) }) }),
}));
vi.mock("@/lib/requireUser", () => ({
  requirePermanentUser: mocks.auth, reserveFreeTierFeature: mocks.reserve,
  trackFreeTierReservation: () => { let reserved = false; return { markReserved: () => { reserved = true; }, refundIfReserved: async () => { if (reserved) { reserved = false; await mocks.refund(); } } }; },
  UnauthorizedError: class extends Error {}, unauthorizedResponse: () => new Response(null, { status: 401 }),
  FreeTierFeatureLimitReachedError: class extends Error {}, freeTierLimitReachedResponse: () => new Response(null, { status: 403 }),
}));
vi.mock("@/lib/aiGateway/gateway", () => ({ callGateway: mocks.gateway, anthropic: { messages: { create: mocks.invoke } } }));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: vi.fn() }));
vi.mock("@/lib/anthropic/models", () => ({ MODEL_BY_FEATURE: { "project-enhance": { provider: "anthropic", model: "fast" }, "resume-summary": { provider: "anthropic", model: "fast" } } }));
import { POST } from "./route";
import { FreeTierFeatureLimitReachedError, UnauthorizedError } from "@/lib/requireUser";
const facts = { experience: [{ job_title: "Volunteer", company: "Club", start_date: "", end_date: "", bullets: ["Helped organise events"] }], projects: [], education: [], skills: [], tools: [] };
const good = { title: "Community event", whatYouDid: "Helped organise events" };
function request(body: unknown = good) { return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }); }
function output(value: unknown) { return { content: [{ type: "text", text: JSON.stringify(value) }], usage: { input_tokens: 10, output_tokens: 20 } }; }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "free" } });
  mocks.reserve.mockResolvedValue(undefined); mocks.rate.mockResolvedValue(null); mocks.count.mockResolvedValue({ count: 0 });
  mocks.single.mockResolvedValue({ data: { resume_content: facts, job_title: "Volunteer" } });
  mocks.gateway.mockResolvedValue(output({ bullets: ["Helped organise events", "Assisted with event preparation"] }));
});
it.each([null, {}, { title: "x" }, { ...good, title: " " }, { ...good, title: 5 }, { ...good, context: "x".repeat(1001) }, { ...good, tools: Array(21).fill("x") }, { ...good, tools: ["x".repeat(101)] }, { ...good, tools: [5] }])("rejects invalid input %j", async (body) => {
  expect((await POST(request(body))).status).toBe(400); expect(mocks.reserve).not.toHaveBeenCalled();
});
it("requires the user's contribution", async () => {
  const response = await POST(request({ title: "x", whatYouDid: " " }));
  expect(await response.json()).toEqual({ error: "Tell us what you did on this project first." });
});
it("returns the new bullets shape", async () => {
  const response = await POST(request()); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ bullets: ["Helped organise events", "Assisted with event preparation"] }); expect(mocks.refund).not.toHaveBeenCalled();
});
it("enforces the free allowance", async () => {
  mocks.reserve.mockRejectedValue(new FreeTierFeatureLimitReachedError("project-enhance", 3));
  expect((await POST(request())).status).toBe(403); expect(mocks.gateway).not.toHaveBeenCalled(); expect(mocks.refund).not.toHaveBeenCalled();
});
it("keeps the hourly cap", async () => {
  mocks.count.mockResolvedValue({ count: 15 }); expect((await POST(request())).status).toBe(429); expect(mocks.reserve).not.toHaveBeenCalled();
});
it.each(["model", "json", "numbers", "vendor", "shape"])("refunds on %s failure", async (kind) => {
  if (kind === "model") mocks.gateway.mockRejectedValueOnce(new Error("offline"));
  if (kind === "json") mocks.gateway.mockResolvedValueOnce({ ...output(null), content: [{ type: "text", text: "bad JSON" }] });
  if (kind === "numbers") mocks.gateway.mockResolvedValueOnce(output({ bullets: ["Helped 500 people"] }));
  if (kind === "vendor") mocks.gateway.mockResolvedValueOnce(output({ bullets: ["Used ChatGPT"] }));
  if (kind === "shape") mocks.gateway.mockResolvedValueOnce(output({ bullets: [null, 5] }));
  expect((await POST(request())).status).toBe(kind === "model" ? 500 : 502); expect(mocks.refund).toHaveBeenCalledTimes(1);
});
it("drops only the bullets with new numbers", async () => {
  mocks.gateway.mockResolvedValueOnce(output({ bullets: ["Helped 500 people", "Helped organise events"] }));
  expect(await (await POST(request())).json()).toEqual({ bullets: ["Helped organise events"] });
});
it("passes only supplied project facts and the honest prompt to the model", async () => {
  mocks.invoke.mockResolvedValueOnce(output({ bullets: ["Helped organise events", "Assisted with preparation"] }));
  mocks.gateway.mockImplementationOnce(async (options) => options.invoke());
  expect((await POST(request())).status).toBe(200);
  const call = mocks.invoke.mock.calls[0][0];
  expect(JSON.parse(call.messages[0].content)).toEqual({ ...good, isCurrent: false });
  expect(call.system).toContain("never upgrade");
  expect(call.system).toContain("If no result is supplied, imply no outcome");
  expect(call.system).not.toContain("inject realistic");
});
it("rejects malformed JSON without reservation", async () => {
  expect((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status).toBe(400);
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("rejects unauthenticated requests before spending a use", async () => {
  mocks.auth.mockRejectedValueOnce(new UnauthorizedError());
  expect((await POST(request())).status).toBe(401);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.gateway).not.toHaveBeenCalled();
});

it("doesn't bypass the hourly cap when the usage lookup fails", async () => {
  mocks.count.mockResolvedValueOnce({ count: null, error: new Error("database offline") });
  expect((await POST(request())).status).toBe(500);
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.gateway).not.toHaveBeenCalled();
});

it("refunds project help cancelled during generation", async () => {
  const controller = new AbortController();
  mocks.gateway.mockImplementationOnce(async () => {
    controller.abort();
    return output({ bullets: ["Helped organise events"] });
  });
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(good), signal: controller.signal }));
  expect(response.status).toBe(499);
  expect(mocks.refund).toHaveBeenCalledTimes(1);
});
