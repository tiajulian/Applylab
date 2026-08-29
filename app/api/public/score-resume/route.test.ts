import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkAndRecordRateLimit: vi.fn(),
}));

vi.mock("@/lib/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
}));

vi.mock("@/lib/anthropic/parseProfile", () => ({
  parseProfileFromText: vi.fn(),
  ProfileParseError: class ProfileParseError extends Error {},
}));

vi.mock("@/lib/resume/scoreReview", () => ({
  scoreResumeReview: vi.fn(),
  hashForScoring: vi.fn(() => "mock-content-hash"),
  sanitizeReviewForPlan: vi.fn((r) => r),
}));

import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { parseProfileFromText } from "@/lib/anthropic/parseProfile";
import { scoreResumeReview } from "@/lib/resume/scoreReview";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/public/score-resume", () => {
  it("returns 400 when input text is too short", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any);

    const req = new Request("http://localhost/api/public/score-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: "Short resume", turnstileToken: "tok" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 403 when Turnstile verification fails", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(false);

    const req = new Request("http://localhost/api/public/score-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "Jane Doe\nOperations Manager with 10 years experience leading logistics teams in Sydney Australia.",
        turnstileToken: "invalid-tok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 429 when IP rate limit is exceeded", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValueOnce(false); // IP rate limit hit

    const req = new Request("http://localhost/api/public/score-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "Jane Doe\nOperations Manager with 10 years experience leading logistics teams in Sydney Australia.",
        turnstileToken: "valid-tok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it("successfully parses, scores and returns anonymous category results", async () => {
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValueOnce(true);

    const mockServiceSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
          }),
        }),
      }),
    });

    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockServiceSelect }),
    } as any);

    vi.mocked(parseProfileFromText).mockResolvedValueOnce({
      fullName: "Jane Doe",
      phone: "+61 400 123 456",
      location: "Sydney",
      linkedin_url: "linkedin.com/in/janedoe",
      work_rights: "Australian Citizen",
      work_experience: [
        {
          job_title: "Operations Manager",
          company: "Acme",
          location: "Sydney",
          start_date: "2020",
          end_date: "Present",
          is_current: true,
          description: "Led logistics operations.",
          wins: [{ text: "Improved delivery speed by 25%", metric: "25%" }],
        },
      ],
      skills: ["Logistics", "Operations"],
      projects: [],
      education: [],
      referees: [],
    });

    vi.mocked(scoreResumeReview).mockResolvedValueOnce({
      overall_score: 82,
      categories: [
        { key: "ats_structure", label: "ATS & structure", score: 18, max_points: 20, locked: true, finding_count: 1 },
        { key: "content_quality", label: "Content quality", score: 24, max_points: 30, locked: true, finding_count: 2 },
        { key: "writing_quality", label: "Writing quality", score: 16, max_points: 20, locked: true, finding_count: 1 },
        { key: "job_optimization", label: "Job optimization", score: 12, max_points: 15, locked: true, finding_count: 1 },
        { key: "application_readiness", label: "Application readiness", score: 12, max_points: 15, locked: true, finding_count: 1 },
      ],
      findings: [
        { id: "f-1", category_key: "ats_structure", title: "Missing LinkedIn link", severity: "warning", status: "open" },
      ],
      content_hash: "mock-content-hash",
      scored_at: "2026-08-29T00:00:00Z",
      unlocked: false,
    });

    const req = new Request("http://localhost/api/public/score-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "Jane Doe\nOperations Manager with 10 years experience leading logistics teams in Sydney Australia.",
        turnstileToken: "valid-tok",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.score).toBe(82);
    expect(json.categories).toHaveLength(5);
    expect(json.candidateName).toBe("Jane Doe");
    expect(json.isAnonymous).toBe(true);
  });
});
