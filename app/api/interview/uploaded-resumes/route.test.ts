import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError, parseProfileFromText } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class PaidFeatureError extends Error {}
  return {
    requireUser: vi.fn(),
    assertPaidPlan: vi.fn(),
    UnauthorizedError,
    PaidFeatureError,
    parseProfileFromText: vi.fn(),
  };
});

vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: async () => null }));
vi.mock("@/lib/requireUser", () => ({
  requireUser,
  assertPaidPlan,
  UnauthorizedError,
  PaidFeatureError,
  unauthorizedResponse: () => new Response(null, { status: 401 }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/anthropic/parseProfile", () => ({ parseProfileFromText, ProfileParseError: class extends Error {} }));
vi.mock("@/lib/resume/extractText", () => ({ extractTextFromFile: vi.fn(), MAX_TEXT_LENGTH: 50_000 }));

function builder(result: any, onInsert?: (row: any) => void) {
  const b: any = {};
  for (const m of ["select", "eq"]) b[m] = () => b;
  b.insert = (row: any) => {
    onInsert?.(row);
    return b;
  };
  b.single = async () => result;
  b.then = (resolve: any) => resolve(result);
  return b;
}

const RESUME = "Jane Smith. Data Analyst at Old Co, 2021 to now. Built sales dashboards in SQL and Tableau. ".repeat(4);
const paste = (text: string) =>
  new Request("http://localhost/api/interview/uploaded-resumes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
  assertPaidPlan.mockImplementation(() => {});
});

describe("POST /api/interview/uploaded-resumes", () => {
  it("is Pro only", async () => {
    assertPaidPlan.mockImplementationOnce(() => {
      throw new PaidFeatureError("Pro");
    });
    const { POST } = await import("./route");
    expect((await POST(paste(RESUME))).status).toBe(403);
  });

  it("rejects text too short to be a resume without calling the AI", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockReturnValue({ from: () => builder({ count: 0 }) });
    const { POST } = await import("./route");
    expect((await POST(paste("Jane Smith, analyst"))).status).toBe(422);
    expect(parseProfileFromText).not.toHaveBeenCalled();
  });

  it("stops at the saved-resume limit", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockReturnValue({ from: () => builder({ count: 20 }) });
    const { POST } = await import("./route");
    expect((await POST(paste(RESUME))).status).toBe(409);
  });

  it("reads the resume once and saves the text with what was read from it", async () => {
    const { createClient, createServiceRoleClient } = await import("@/lib/supabase/server");
    const parsed = { work_experience: [{ job_title: "Data Analyst" }] };
    parseProfileFromText.mockResolvedValueOnce(parsed);
    (createClient as any).mockReturnValue({ from: () => builder({ count: 0 }) });
    const inserted: any[] = [];
    (createServiceRoleClient as any).mockReturnValue({
      from: () => builder({ data: { id: "u1", name: "Resume · Data Analyst", source: "paste" }, error: null }, (row) => inserted.push(row)),
    });

    const { POST } = await import("./route");
    const res = await POST(paste(`  ${RESUME}  `));

    expect(res.status).toBe(200);
    expect((await res.json()).resume.id).toBe("u1");
    expect(inserted[0]).toEqual({
      user_id: "user-1",
      name: "Resume · Data Analyst",
      source: "paste",
      raw_text: RESUME.trim(),
      parsed,
    });
  });
});
