import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateResume, insert, fetchBridgeItemsById } = vi.hoisted(() => ({
  generateResume: vi.fn(),
  insert: vi.fn(),
  fetchBridgeItemsById: vi.fn(),
}));

class UnauthorizedError extends Error {}
class FreeLimitReachedError extends Error {}

vi.mock("@/lib/requireUser", () => ({
  FREE_RESUME_LIMIT: 2,
  FreeLimitReachedError,
  UnauthorizedError,
  requirePermanentUser: vi.fn().mockResolvedValue({
    authUserId: "user-1",
    appUser: { id: "user-1", plan: "free", full_name: "Sam Lee", email: "sam@example.com" },
  }),
  reserveResumeGeneration: vi.fn().mockResolvedValue(undefined),
  refundResumeGeneration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/rateLimit", () => ({
  acquireHeavySlots: vi.fn().mockResolvedValue({ release: vi.fn().mockResolvedValue(undefined) }),
  enforceRateLimit: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/aiGateway/errorResponse", () => ({ aiErrorResponse: () => null }));
vi.mock("@/lib/anthropic/generateResume", () => ({ generateResume }));
vi.mock("@/lib/resume/versions", () => ({ saveVersionSnapshot: vi.fn() }));
vi.mock("@/lib/resume/fetchBridgeItems", () => ({ fetchBridgeItemsById }));
vi.mock("@/lib/resume/fetchConfirmedRoleDuties", () => ({ fetchRoleDutiesContext: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/resume/factCheck", () => ({
  buildConfirmedBridge: vi.fn(),
  flagUnconfirmedBridgeClaims: vi.fn().mockReturnValue([]),
  flagUnverifiedFacts: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/resume/qualityGate", () => ({ runQualityGate: vi.fn().mockReturnValue({}) }));

const profileRow = {
  work_rights: "Australian citizen",
  phone: "0400000000",
  location: "Parramatta, NSW",
  skills: ["Excel", "Reporting", "Scheduling"],
  work_experience: [
    {
      job_title: "Coordinator",
      company: "Acme",
      location: "Sydney",
      start_date: "Jan 2020",
      end_date: "Present",
      is_current: true,
      description: "Coordinated dispatch",
    },
  ],
  education: [],
  referees: [],
  projects: [],
};

const from = vi.fn((table: string) => {
  if (table === "user_profiles") {
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: profileRow }) }) }) };
  }
  if (table === "resumes") {
    return { insert: (row: unknown) => ({ select: () => ({ single: async () => insert(row) }) }) };
  }
  throw new Error(`unexpected table ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({ from }),
  createServiceRoleClient: () => ({}),
}));

const { POST } = await import("./route");

function post(body: unknown) {
  return POST(new Request("http://test/api/generate-resume", { method: "POST", body: JSON.stringify(body) }));
}

describe("POST /api/generate-resume", () => {
  beforeEach(() => {
    generateResume.mockReset().mockResolvedValue({ summary: "s" });
    insert.mockReset().mockImplementation(async (row) => ({ data: { id: "res-1", ...(row as object) }, error: null }));
    fetchBridgeItemsById.mockReset();
    from.mockClear();
  });

  it("still requires a job description for a normal (tailored) request", async () => {
    const response = await post({ jobTitle: "Analyst", template: "clean" });

    expect(response.status).toBe(400);
    expect(generateResume).not.toHaveBeenCalled();
  });

  it("does not treat a missing job description as a general resume without the explicit mode", async () => {
    const response = await post({ template: "clean", mode: "tailored" });

    expect(response.status).toBe(400);
    expect(generateResume).not.toHaveBeenCalled();
  });

  it("rejects a whitespace-only job ad instead of quietly building a general resume", async () => {
    const response = await post({ jobDescription: "   ", template: "clean" });

    expect(response.status).toBe(400);
    expect(generateResume).not.toHaveBeenCalled();
  });

  it("generates a general resume with no job ad, no bridge, and a neutral label", async () => {
    const response = await post({
      mode: "general",
      template: "clean",
      // Anything a client sends for the tailored flow is ignored in general mode.
      jobDescription: "Should be ignored",
      jobTitle: "Ignored Title",
      companyName: "Ignored Co",
      bridgeId: "bridge-1",
    });

    expect(response.status).toBe(200);
    expect(generateResume).toHaveBeenCalledWith(
      expect.objectContaining({ jobDescription: "", jobTitle: "", companyName: "" }),
      "user-1",
      expect.anything()
    );
    expect(from).not.toHaveBeenCalledWith("skills_bridges");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_description: "",
        job_title: "General resume",
        company_name: null,
        skills_bridge_id: null,
      })
    );
  });
});
