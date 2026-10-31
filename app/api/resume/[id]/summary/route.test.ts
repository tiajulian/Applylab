import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ reserve: vi.fn(), refund: vi.fn(), gateway: vi.fn(), single: vi.fn(), eq: vi.fn(), count: vi.fn(), rate: vi.fn(), auth: vi.fn(), invoke: vi.fn() }));
vi.mock("@/lib/aiGateway/errorResponse", () => ({ aiErrorResponse: () => null }));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from: () => ({ select: () => ({ eq: mocks.eq }) }) }),
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
const good = { currentSummary: "" };
function request(body: unknown = good) { return new Request("http://localhost", { method: "POST", body: JSON.stringify(body) }); }
function post(body: unknown = good) { return POST(request(body), { params: Promise.resolve({ id: "resume-1" }) }); }
function output(value: unknown) { return { content: [{ type: "text", text: JSON.stringify(value) }], usage: { input_tokens: 10, output_tokens: 20 } }; }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockImplementation(() => ({ eq: mocks.eq, single: mocks.single }));
  mocks.auth.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "free" } });
  mocks.reserve.mockResolvedValue(undefined); mocks.rate.mockResolvedValue(null);
  mocks.single.mockResolvedValue({ data: { resume_content: facts, job_title: "Volunteer" } });
  mocks.gateway.mockResolvedValue(output({ summary: "Volunteer who helped organise community events. Assisted with event preparation." }));
});
it.each([null, {}, { currentSummary: 5 }, { currentSummary: "x".repeat(2001) }, { ...good, targetRole: "x".repeat(201) }, { ...good, notes: "x".repeat(1001) }, { ...good, notes: [] }])("rejects invalid input %j", async (body) => {
  expect((await post(body)).status).toBe(400); expect(mocks.reserve).not.toHaveBeenCalled();
});
it("returns 404 for a missing or unowned resume", async () => {
  mocks.single.mockResolvedValue({ data: null, error: new Error("missing") });
  expect((await post()).status).toBe(404); expect(mocks.reserve).not.toHaveBeenCalled();
});
it("asks for facts without reserving even if only a summary and skills exist", async () => {
  mocks.single.mockResolvedValue({ data: { resume_content: { ...facts, experience: [], skills: ["Communication"] } } });
  expect(await (await post({ currentSummary: "Motivated candidate" })).json()).toEqual({ needsMoreDetail: true, message: "Add a role, project or qualification first, or tell us a bit about yourself below." });
  expect(mocks.reserve).not.toHaveBeenCalled();
});
it.each(["notes", "project", "education"])("accepts %s as sufficient facts", async (kind) => {
  mocks.single.mockResolvedValue({ data: { resume_content: { ...facts, experience: [], projects: kind === "project" ? [{ title: "Event" }] : [], education: kind === "education" ? [{ degree: "Certificate" }] : [] } } });
  expect((await post({ ...good, notes: kind === "notes" ? "Helped organise community fundraising events" : "" })).status).toBe(200);
  expect(mocks.reserve).toHaveBeenCalled();
});
it("enforces the free allowance", async () => {
  mocks.reserve.mockRejectedValue(new FreeTierFeatureLimitReachedError("resume-summary", 1));
  expect((await post()).status).toBe(403); expect(mocks.gateway).not.toHaveBeenCalled(); expect(mocks.refund).not.toHaveBeenCalled();
});
it("enforces the hourly cap before loading the resume", async () => {
  mocks.rate.mockResolvedValue(new Response(null, { status: 429 }));
  expect((await post()).status).toBe(429); expect(mocks.single).not.toHaveBeenCalled();
});
it.each(["model", "json", "numbers", "status", "vendor", "shape"])("refunds on %s failure", async (kind) => {
  if (kind === "model") mocks.gateway.mockRejectedValueOnce(new Error("offline"));
  if (kind === "json") mocks.gateway.mockResolvedValueOnce({ ...output(null), content: [{ type: "text", text: "bad JSON" }] });
  if (kind === "numbers") mocks.gateway.mockResolvedValueOnce(output({ summary: "Organised 500 events." }));
  if (kind === "status") mocks.gateway.mockResolvedValueOnce(output({ summary: "Currently studying a degree." }));
  if (kind === "vendor") mocks.gateway.mockResolvedValueOnce(output({ summary: "Used ChatGPT." }));
  if (kind === "shape") mocks.gateway.mockResolvedValueOnce(output({ summary: [] }));
  expect((await post()).status).toBe(kind === "model" ? 500 : 502); expect(mocks.refund).toHaveBeenCalledTimes(1);
});
it("returns the summary shape without consuming a refund", async () => {
  const response = await post(); expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ summary: "Volunteer who helped organise community events. Assisted with event preparation." }); expect(mocks.refund).not.toHaveBeenCalled();
});
it("accepts a status explicitly supplied in notes", async () => {
  mocks.gateway.mockResolvedValueOnce(output({ summary: "Currently studying a degree." }));
  expect((await post({ ...good, notes: "Currently studying a degree" })).status).toBe(200);
});it("passes facts separately from the target role and applies the years rule", async () => {
  mocks.invoke.mockResolvedValueOnce(output({ summary: "Volunteer who helped organise events." }));
  mocks.gateway.mockImplementationOnce(async (options) => options.invoke());
  expect((await post({ ...good, targetRole: "Data analyst", notes: "Helped with preparation" })).status).toBe(200);
  const call = mocks.invoke.mock.calls[0][0];
  const input = JSON.parse(call.messages[0].content);
  expect(input.targetTitle).toBe("Data analyst"); expect(input.relevantYearsCeiling).toBe(0);
  expect(input.facts.experience).toMatchObject(facts.experience);
  expect(call.system).toContain("total career length is overall experience");
  expect(call.system).toContain("never upgrade");
  expect(mocks.rate).toHaveBeenCalledWith("resume-summary:user-1", 20, 3600000);
});
it("rejects malformed JSON without reservation", async () => {
  const response = await POST(new Request("http://localhost", { method: "POST", body: "{" }), { params: Promise.resolve({ id: "resume-1" }) });
  expect(response.status).toBe(400); expect(mocks.reserve).not.toHaveBeenCalled();
});

it("asks for more instead of spending the only use on a greeting", async () => {
  mocks.single.mockResolvedValue({ data: { resume_content: {} } });
  expect(await (await post({ ...good, notes: "Hi" })).json()).toMatchObject({ needsMoreDetail: true });
  expect(mocks.reserve).not.toHaveBeenCalled();
});

it("can improve a factual existing summary without other sections", async () => {
  mocks.single.mockResolvedValue({ data: { resume_content: {} } });
  expect((await post({ currentSummary: "Volunteer who helped organise community events." })).status).toBe(200);
});

it("uses unsaved editor facts rather than an older saved resume", async () => {
  mocks.single.mockResolvedValue({ data: { resume_content: {}, job_title: "Volunteer" } });
  mocks.invoke.mockResolvedValueOnce(output({ summary: "Volunteer who helped organise events." }));
  mocks.gateway.mockImplementationOnce(async (options) => options.invoke());
  expect((await post({ ...good, resumeContent: facts })).status).toBe(200);
  expect(JSON.parse(mocks.invoke.mock.calls[0][0].messages[0].content).facts.experience[0].bullets).toEqual(["Helped organise events"]);
});

it("refunds a request cancelled during generation", async () => {
  const controller = new AbortController();
  mocks.gateway.mockImplementationOnce(async () => {
    controller.abort();
    return output({ summary: "Volunteer who helped organise events." });
  });
  const response = await POST(new Request("http://localhost", { method: "POST", body: JSON.stringify(good), signal: controller.signal }), { params: Promise.resolve({ id: "resume-1" }) });
  expect(response.status).toBe(499);
  expect(mocks.refund).toHaveBeenCalledTimes(1);
});

it("recognises current study from structured education dates", async () => {
  mocks.single.mockResolvedValue({ data: { resume_content: { education: [{ degree: "Degree", institution: "University", year: "2024 - Current" }] } } });
  mocks.gateway.mockResolvedValueOnce(output({ summary: "Currently studying a degree." }));
  expect((await post()).status).toBe(200);
});

it("refunds when the model needs more facts", async () => {
  mocks.gateway.mockResolvedValueOnce(output({ needsMoreDetail: true }));
  const response = await post();
  expect(await response.json()).toMatchObject({ needsMoreDetail: true });
  expect(mocks.refund).toHaveBeenCalledTimes(1);
});

it("scopes the resume lookup to the authenticated owner", async () => {
  expect((await post()).status).toBe(200);
  expect(mocks.eq).toHaveBeenCalledWith("id", "resume-1");
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
});

it("rejects unauthenticated requests before accessing resumes or AI", async () => {
  mocks.auth.mockRejectedValueOnce(new UnauthorizedError());
  expect((await post()).status).toBe(401);
  expect(mocks.single).not.toHaveBeenCalled();
  expect(mocks.reserve).not.toHaveBeenCalled();
  expect(mocks.gateway).not.toHaveBeenCalled();
});

it.each([null, [], "text", { summary: "x".repeat(100_001) }])("rejects invalid editor content without spending a use", async (resumeContent) => {
  expect((await post({ ...good, resumeContent })).status).toBe(400);
  expect(mocks.reserve).not.toHaveBeenCalled();
});
