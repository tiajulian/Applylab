import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireUser, UnauthorizedError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {}
  return {
    requireUser: vi.fn(),
    UnauthorizedError,
  };
});

vi.mock("@/lib/requireUser", () => ({
  requireUser,
  UnauthorizedError,
}));

vi.mock("@/lib/resume/parsedJobAdCache", () => ({
  getOrParseCompactJobAd: vi.fn().mockResolvedValue({
    companyName: "Acme",
    jobTitle: "Operations Manager",
    mustHave: [],
    niceToHave: [],
    responsibilities: [],
    keywords: [],
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/resume/scoreReview", () => ({
  scoreResumeReview: vi.fn(),
  sanitizeReviewForPlan: vi.fn((review, isUnlocked) => ({
    ...review,
    unlocked: isUnlocked,
    categories: review.categories.map((c: any) => ({ ...c, locked: !isUnlocked })),
  })),
}));

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { scoreResumeReview } from "@/lib/resume/scoreReview";

beforeEach(() => {
  vi.clearAllMocks();
});

const sampleResumeContent = {
  contact: { name: "Jane Doe", email: "jane@example.com", phone: "+61 400 123 456", location: "Sydney", linkedin: "", work_rights: "" },
  target_titles: ["Operations Lead"],
  summary: "Experienced leader.",
  skills: ["Leadership", "Operations"],
  tools: [],
  experience: [
    {
      job_title: "Manager",
      company: "Acme",
      company_description: "",
      location: "Sydney",
      start_date: "2022",
      end_date: "Present",
      bullets: ["Led a team of 10."],
    },
  ],
  projects: [],
  education: [],
  referees: [],
};

describe("GET /api/resume/[id]/review", () => {
  it("returns 401 when logged out", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError("Not authenticated"));
    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/resume/res-1/review");
    const res = await GET(req, { params: { id: "res-1" } });
    expect(res.status).toBe(401);
  });

  it("returns stored review with stale detection", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", plan: "free" },
    });

    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "res-1",
        user_id: "user-1",
        resume_content: sampleResumeContent,
        review_overall_score: 75,
        review_categories: [
          { key: "ats_structure", label: "ATS & structure", score: 15, max_points: 20, locked: true, finding_count: 1 },
        ],
        review_findings: [],
        review_content_hash: "old-hash",
        review_scored_at: "2026-08-28T00:00:00Z",
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    vi.mocked(createClient).mockReturnValue({ from: mockSelect } as any);

    const { GET } = await import("./route");
    const req = new Request("http://localhost/api/resume/res-1/review");
    const res = await GET(req, { params: { id: "res-1" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.review).toBeDefined();
    expect(json.review.overall_score).toBe(75);
    expect(json.isStale).toBe(true);
  });
});

describe("POST /api/resume/[id]/review", () => {
  it("computes and stores a new review when requested", async () => {
    requireUser.mockResolvedValueOnce({
      authUserId: "user-1",
      appUser: { id: "user-1", plan: "pro" },
    });

    const mockSingle = vi.fn().mockResolvedValueOnce({
      data: {
        id: "res-1",
        user_id: "user-1",
        resume_content: sampleResumeContent,
        job_description: "Operations Manager required at TechCorp.",
        review_overall_score: null,
      },
      error: null,
    });

    const mockSelect = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: mockSingle }),
      }),
    });
    vi.mocked(createClient).mockReturnValue({ from: mockSelect } as any);

    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn().mockReturnValue({ update: mockUpdate }) } as any);

    vi.mocked(scoreResumeReview).mockResolvedValueOnce({
      overall_score: 82,
      categories: [
        { key: "ats_structure", label: "ATS & structure", score: 18, max_points: 20, locked: false, finding_count: 0 },
      ],
      findings: [],
      content_hash: "fresh-hash",
      scored_at: "2026-08-28T01:00:00Z",
      unlocked: true,
    });

    const { POST } = await import("./route");
    const req = new Request("http://localhost/api/resume/res-1/review", { method: "POST" });
    const res = await POST(req, { params: { id: "res-1" } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.review.overall_score).toBe(82);
    expect(json.fromCache).toBe(false);
  });
});
