import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeContent } from "@/types";

const { generateResume, insert, fetchBridgeItemsById } = vi.hoisted(() => ({
  generateResume: vi.fn(),
  insert: vi.fn(),
  fetchBridgeItemsById: vi.fn(),
}));

class UnauthorizedError extends Error {}
class FreeLimitReachedError extends Error {}

vi.mock("@/lib/requireUser", () => ({
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  FREE_RESUME_LIMIT: 2,
  FreeLimitReachedError,
  UnauthorizedError,
  requirePermanentUser: vi.fn().mockResolvedValue({
    authUserId: "user-1",
    appUser: { id: "user-1", plan: "free", full_name: "Sam Lee", email: "sam@example.com" },
  }),
  reserveResumeGeneration: vi.fn().mockResolvedValue(undefined),
  refundResumeGeneration: vi.fn().mockResolvedValue(undefined),
  markFreeAllowanceResume: vi.fn().mockResolvedValue(undefined),
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
  pruneUnsupportedSkillsAndTools: vi.fn((resume) => resume),
  stripCrossRoleTools: vi.fn((resume) => resume),
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

const storedProfile: { current: unknown } = { current: profileRow };
const profileUpsert = vi.fn(async (_row: unknown) => ({ error: null }));
const usersUpdate = vi.fn(async (_row: unknown) => ({ error: null }));

const from = vi.fn((table: string) => {
  if (table === "user_profiles") {
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: storedProfile.current }) }) }),
      upsert: profileUpsert,
    };
  }
  if (table === "resumes") {
    return { insert: (row: unknown) => ({ select: () => ({ single: async () => insert(row) }) }) };
  }
  if (table === "users") {
    return { update: (row: unknown) => ({ eq: async () => usersUpdate(row) }) };
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
    profileUpsert.mockClear();
    usersUpdate.mockClear();
    storedProfile.current = profileRow;
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
      jobUrl: "https://www.adzuna.com.au/land/ad/1",
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
        job_url: null,
      })
    );
  });

  describe("from an uploaded resume", () => {
    const importedProfile = {
      fullName: "Sam Q. Lee",
      phone: "",
      location: "",
      linkedin_url: "",
      work_rights: "",
      skills: ["Forklift"],
      summary: "Reliable storeperson, licenced forklift operater.",
      tools: [],
      work_experience: [
        {
          job_title: "Storeperson",
          company: "Depot Co",
          start_date: "2019",
          end_date: "2021",
          description: "",
          bullets: ["Picked and packed 200 orders a day", "Ran the forklift", "Did stocktakes", "Trained new staff", "Kept the dock clean", "Loaded trucks"],
        },
      ],
      projects: [],
      education: [],
      referees: [],
    };

    it("opens a general resume exactly as the file wrote it, without the AI, and isn't held to the profile minimum", async () => {
      const response = await post({ mode: "general", source: "upload", importedProfile });

      expect(response.status).toBe(200);
      expect(generateResume).not.toHaveBeenCalled();
      const [row] = insert.mock.calls[0] as unknown as [{ job_title: string; resume_content: ResumeContent; gate_result: unknown }];
      expect(row.job_title).toBe("General resume");
      // The file is the user's own facts, so nothing is fact-checked or gated against them.
      expect(row.gate_result).toBeNull();
      const content = row.resume_content;
      expect(content.contact.name).toBe("Sam Q. Lee");
      // Typos and all: the reviewer suggests fixes, nothing rewrites them.
      expect(content.summary).toBe("Reliable storeperson, licenced forklift operater.");
      expect(content.skills).toEqual(["Forklift"]);
      expect(content.experience).toHaveLength(1);
      expect(content.experience[0].bullets).toEqual(importedProfile.work_experience[0].bullets);
      // Contact details the file lacks come from the saved profile.
      expect(content.contact.location).toBe("Parramatta, NSW");
      expect(content.contact.work_rights).toBe("Australian citizen");
    });

    it("adds the file's new details to the saved profile without changing what's there", async () => {
      const response = await post({ mode: "general", source: "upload", importedProfile });

      expect(response.status).toBe(200);
      const [row] = profileUpsert.mock.calls[0] as unknown as [Record<string, unknown>];
      expect(row.skills).toEqual([...profileRow.skills, "Forklift"]);
      expect((row.work_experience as Array<{ company: string }>).map((e) => e.company)).toEqual(["Acme", "Depot Co"]);
      // The file had no contact details, and the saved ones are kept as they are.
      expect(row).not.toHaveProperty("location");
      expect(row).not.toHaveProperty("work_rights");
      // users is kept in step: the score is recomputed, and the account already has a name.
      const [userRow] = usersUpdate.mock.calls[0] as unknown as [Record<string, unknown>];
      expect(typeof userRow.profile_completeness).toBe("number");
      expect(userRow).not.toHaveProperty("full_name");
    });

    it("writes nothing to the profile when the file adds nothing new", async () => {
      await post({
        mode: "general",
        source: "upload",
        importedProfile: { ...importedProfile, skills: ["excel"], work_experience: [{ job_title: "coordinator", company: "ACME" }] },
      });

      expect(insert).toHaveBeenCalled();
      expect(profileUpsert).not.toHaveBeenCalled();
      expect(usersUpdate).not.toHaveBeenCalled();
    });

    it("refuses a file with nothing to write from", async () => {
      const response = await post({
        mode: "general",
        source: "upload",
        importedProfile: { ...importedProfile, skills: [], work_experience: [] },
      });

      expect(response.status).toBe(422);
      expect(generateResume).not.toHaveBeenCalled();
    });

    it("writes a tailored resume from the file too", async () => {
      const response = await post({ jobDescription: "An ad", jobTitle: "Storeperson", source: "upload", importedProfile });

      expect(response.status).toBe(200);
      const [input] = generateResume.mock.calls[0];
      expect(input.jobDescription).toBe("An ad");
      expect(input.profile.skills).toEqual(["Forklift"]);
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ job_title: "Storeperson" }));
    });
  });
});
