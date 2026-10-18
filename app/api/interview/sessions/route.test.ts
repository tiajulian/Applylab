import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  class PaidFeatureError extends Error {}
  return {
    requireUser: vi.fn(),
    assertPaidPlan: vi.fn(),
    UnauthorizedError,
    PaidFeatureError,
  };
});

vi.mock("@/lib/rateLimit", () => ({
  enforceRateLimit: async () => null,
  acquireHeavySlots: async () => ({ release: async () => {} }),
}));

vi.mock("@/lib/requireUser", () => ({
  requireUser,
  assertPaidPlan,
  UnauthorizedError,
  PaidFeatureError,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/resume/parsedJobAdCache", () => ({
  getOrParseCompactJobAd: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/gemini/generateInterviewQuestions", () => ({
  generateInterviewQuestions: vi.fn().mockResolvedValue({ questions: [], usedFallback: false }),
}));

function makeRequest(body: any) {
  return new Request("http://localhost/api/interview/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/interview/sessions - auth & entitlement", () => {
  it("returns 401 when logged out", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "general" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 for a free-plan user whose free practice is used", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1", plan: "free", free_interviews_used: 1 } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "general" }));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("FREE_LIMIT_REACHED");
  });
});

describe("POST /api/interview/sessions - input validation", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
    assertPaidPlan.mockImplementation(() => {});
  });

  it("rejects a missing resume_id", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ stage_type: "general" }));
    expect(res.status).toBe(400);
  });

  it("rejects an invalid stage_type", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "not_a_real_stage" }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/interview/sessions - tone", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
    assertPaidPlan.mockImplementation(() => {});
  });

  it("rejects an unknown pressure_level instead of silently ignoring it", async () => {
    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "general", pressure_level: "brutal" }));
    expect(res.status).toBe(400);
  });
});

vi.mock("@/lib/interview/questionContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/interview/questionContext")>()),
  loadQuestionContext: vi.fn().mockResolvedValue({ jobTitle: "Analyst", companyName: "Acme", profile: {} }),
}));

describe("POST /api/interview/sessions - free practice", () => {
  function builder(result: any, onInsert?: (row: any) => void) {
    const b: any = {};
    for (const m of ["select", "eq", "order", "update"]) b[m] = () => b;
    b.insert = (row: any) => {
      onInsert?.(row);
      return b;
    };
    b.single = async () => result;
    b.maybeSingle = async () => result;
    b.then = (resolve: any) => resolve(result);
    return b;
  }

  it("forces a short Standard session at Realistic tone whatever the client asks for", async () => {
    const { createClient, createServiceRoleClient } = await import("@/lib/supabase/server");
    const { generateInterviewQuestions } = await import("@/lib/gemini/generateInterviewQuestions");
    requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "free", free_interviews_used: 0 } });
    (createClient as any).mockReturnValue({ from: () => builder({ data: { id: "r1" }, error: null }) });
    const inserted: any[] = [];
    (createServiceRoleClient as any).mockReturnValue({
      from: (table: string) =>
        table === "users"
          ? builder({ data: { id: "user-1" }, error: null })
          : table === "interview_sessions"
            ? builder({ data: { id: "s1" }, error: null }, (row) => inserted.push(row))
            : builder({ data: [{ id: "t1", order_index: 1, question_type: "behavioural", question_text: "Q", is_followup: false }], error: null }),
    });
    (generateInterviewQuestions as any).mockResolvedValueOnce({
      questions: [1, 2, 3].map((i) => ({ order_index: i, question_type: "behavioural", question_text: `Q${i}`, competency_focus: "x" })),
      usedFallback: false,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest({ resume_id: "r1", stage_type: "panel", pressure_level: "tough" }));

    expect(res.status).toBe(200);
    expect(generateInterviewQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ stageType: "general", questionCount: 3, pressureLevel: "realistic" })
    );
    expect(inserted[0]).toMatchObject({ stage_type: "general", is_free_allowance: true, question_count_target: 3 });
  });
});

describe("POST /api/interview/sessions - Upload my resume", () => {
  const AD = "We are hiring a data analyst to build dashboards and report on sales. ".repeat(3);
  const uploadBody = (extra: Record<string, unknown> = {}) => ({
    uploaded_resume_id: "u1",
    job_title: "Data Analyst",
    company_name: "Acme",
    job_description: AD,
    stage_type: "general",
    ...extra,
  });

  function builder(result: any, onInsert?: (row: any) => void) {
    const b: any = {};
    for (const m of ["select", "eq", "order", "update"]) b[m] = () => b;
    b.insert = (row: any) => {
      onInsert?.(row);
      return b;
    };
    b.single = async () => result;
    b.maybeSingle = async () => result;
    b.then = (resolve: any) => resolve(result);
    return b;
  }

  beforeEach(() => {
    requireUser.mockResolvedValue({ authUserId: "user-1", appUser: { id: "user-1", plan: "pro" } });
  });

  it("is Pro only, even with the free practice unused", async () => {
    requireUser.mockResolvedValueOnce({ authUserId: "user-1", appUser: { id: "user-1", plan: "free", free_interviews_used: 0 } });
    const { POST } = await import("./route");
    const res = await POST(makeRequest(uploadBody()));
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("PRO_REQUIRED");
  });

  it("rejects sending both kinds of resume", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest(uploadBody({ resume_id: "r1" })))).status).toBe(400);
  });

  it("needs a job title and the whole job ad", async () => {
    const { POST } = await import("./route");
    expect((await POST(makeRequest(uploadBody({ job_title: "  " })))).status).toBe(400);
    expect((await POST(makeRequest(uploadBody({ job_description: "Short ad" })))).status).toBe(400);
  });

  it("404s on a resume that isn't the user's", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    (createClient as any).mockReturnValue({ from: () => builder({ data: null, error: null }) });
    const { POST } = await import("./route");
    expect((await POST(makeRequest(uploadBody()))).status).toBe(404);
  });

  it("grounds questions in the uploaded resume only and keeps the job on the session", async () => {
    const { createClient, createServiceRoleClient } = await import("@/lib/supabase/server");
    const { generateInterviewQuestions } = await import("@/lib/gemini/generateInterviewQuestions");
    const { loadQuestionContext } = await import("@/lib/interview/questionContext");
    const parsed = { work_experience: [{ job_title: "Analyst", company: "Old Co", description: "Reports" }], skills: ["SQL"] };
    (createClient as any).mockReturnValue({
      from: (table: string) => builder(table === "uploaded_resumes" ? { data: { id: "u1", parsed }, error: null } : { data: null, error: null }),
    });
    const inserted: any[] = [];
    (createServiceRoleClient as any).mockReturnValue({
      from: (table: string) =>
        table === "interview_sessions"
          ? builder({ data: { id: "s1" }, error: null }, (row) => inserted.push(row))
          : builder({ data: [{ id: "t1", order_index: 1, question_type: "behavioural", question_text: "Q", is_followup: false }], error: null }),
    });
    (generateInterviewQuestions as any).mockResolvedValueOnce({
      questions: [{ order_index: 1, question_type: "behavioural", question_text: "Q1", competency_focus: "x" }],
      usedFallback: false,
    });

    const { POST } = await import("./route");
    const res = await POST(makeRequest(uploadBody()));

    expect(res.status).toBe(200);
    expect(loadQuestionContext).not.toHaveBeenCalled();
    expect(generateInterviewQuestions).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "Data Analyst",
        companyName: "Acme",
        profile: parsed,
        confirmedBridgeItems: [],
        confirmedRoleDuties: [],
      })
    );
    expect(inserted[0]).toMatchObject({
      resume_id: null,
      uploaded_resume_id: "u1",
      job_title: "Data Analyst",
      company_name: "Acme",
      job_description: AD.trim(),
      is_free_allowance: false,
    });
  });
});
