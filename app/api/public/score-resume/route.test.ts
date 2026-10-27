import { describe, it, expect, vi, beforeEach } from "vitest";

// A claim ticket from an earlier score, if a test sets one.
let previousClaimTicket: string | undefined;
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn((name: string) => (name === "score_claim" && previousClaimTicket ? { value: previousClaimTicket } : undefined)),
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
import { createHash } from "node:crypto";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { parseProfileFromText } from "@/lib/anthropic/parseProfile";
import { scoreResumeReview } from "@/lib/resume/scoreReview";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  previousClaimTicket = undefined;
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
    // api_cost_log.user_id is a uuid: anonymous calls must log null, never a placeholder string.
    expect(parseProfileFromText).toHaveBeenCalledWith(expect.any(String), null);
    expect(scoreResumeReview).toHaveBeenCalledWith(expect.anything(), null, null, false);
  });

  // Shared setup for the paths that reach scoring: a passing captcha and limit, a cache miss, and
  // canned parse/score results. Returns the service-client spies so tests can see what was saved.
  function setUpScoring(user: { id: string; is_anonymous: boolean } | null) {
    vi.mocked(createClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValueOnce(true);
    vi.mocked(checkAndRecordRateLimit).mockResolvedValueOnce(true);

    const cacheLookup = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null }) }),
        }),
      }),
    });
    const resumeInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: "resume-1" }, error: null }) }),
    });
    const pendingInsert = vi.fn().mockResolvedValue({ error: null });
    const pendingDeleteEq = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createServiceRoleClient).mockReturnValue({
      from: vi.fn((table: string) =>
        table === "pending_resume_scores"
          ? { insert: pendingInsert, delete: vi.fn().mockReturnValue({ eq: pendingDeleteEq }) }
          : { select: cacheLookup, insert: resumeInsert }
      ),
    } as any);

    vi.mocked(parseProfileFromText).mockResolvedValueOnce({
      fullName: "Jane Doe",
      work_experience: [{ job_title: "Operations Manager", company: "Acme", description: "Led logistics.", wins: [] }],
      skills: [],
      projects: [],
      education: [],
      referees: [],
    } as any);
    vi.mocked(scoreResumeReview).mockResolvedValueOnce({
      overall_score: 70,
      categories: [],
      findings: [],
      content_hash: "hash-1",
      scored_at: "2026-10-27T00:00:00Z",
      unlocked: false,
    } as any);

    return { resumeInsert, pendingInsert, pendingDeleteEq };
  }

  const scoreRequest = () =>
    new Request("http://localhost/api/public/score-resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawText: "Jane Doe\nOperations Manager with 10 years experience leading logistics teams in Sydney Australia.",
        turnstileToken: "valid-tok",
      }),
    });

  it("holds a visitor's score for claiming, storing only the token's hash", async () => {
    const { resumeInsert, pendingInsert } = setUpScoring(null);

    const res = await POST(scoreRequest());
    expect(res.status).toBe(200);
    expect(resumeInsert).not.toHaveBeenCalled();

    const token = res.cookies.get("score_claim")?.value;
    expect(token).toBeTruthy();
    expect(res.cookies.get("score_claim")?.httpOnly).toBe(true);
    const held = pendingInsert.mock.calls[0][0];
    expect(held.claim_hash).toBe(createHash("sha256").update(token!).digest("hex"));
    expect(JSON.stringify(held)).not.toContain(token!);
    expect(held).toMatchObject({ review_overall_score: 70, review_content_hash: "hash-1", job_title: "Operations Manager" });
    expect((await res.json()).resumeId).toBeNull();
  });

  it("holds a guest's score too (guests can't own resumes) and shows them the signup gate", async () => {
    const { resumeInsert, pendingInsert } = setUpScoring({ id: "guest-1", is_anonymous: true });

    const res = await POST(scoreRequest());
    expect(resumeInsert).not.toHaveBeenCalled();
    expect(pendingInsert).toHaveBeenCalledTimes(1);
    const json = await res.json();
    expect(json.isAnonymous).toBe(true);
    expect(json.held).toBe(true);
    expect(json.isGuest).toBe(true);
  });

  it("leaves a signed-in user's earlier ticket alone (it's still claimable)", async () => {
    previousClaimTicket = "old-ticket";
    const { pendingDeleteEq } = setUpScoring({ id: "user-1", is_anonymous: false });

    const res = await POST(scoreRequest());
    expect(pendingDeleteEq).not.toHaveBeenCalled();
    expect(res.cookies.get("score_claim")).toBeUndefined();
  });

  it("drops an earlier held score and replaces its ticket when the visitor scores again", async () => {
    previousClaimTicket = "old-ticket";
    const { pendingDeleteEq } = setUpScoring(null);

    const res = await POST(scoreRequest());
    expect(pendingDeleteEq).toHaveBeenCalledWith("claim_hash", createHash("sha256").update("old-ticket").digest("hex"));
    const ticket = res.cookies.get("score_claim")?.value;
    expect(ticket).toBeTruthy();
    expect(ticket).not.toBe("old-ticket");
  });

  it("clears an earlier ticket when the new score can't be held, so it can't claim the wrong resume", async () => {
    previousClaimTicket = "old-ticket";
    const { pendingInsert } = setUpScoring(null);
    pendingInsert.mockResolvedValueOnce({ error: { message: "db down" } });

    const res = await POST(scoreRequest());
    expect(res.cookies.get("score_claim")?.value).toBe("");
  });

  it("saves a signed-in user's scored resume straight to their account", async () => {
    const { resumeInsert, pendingInsert } = setUpScoring({ id: "user-1", is_anonymous: false });

    const res = await POST(scoreRequest());
    const json = await res.json();
    expect(pendingInsert).not.toHaveBeenCalled();
    expect(res.cookies.get("score_claim")).toBeUndefined();
    // job_description is a required column; leaving it out made every insert fail silently.
    expect(resumeInsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", job_description: "" }));
    expect(json.resumeId).toBe("resume-1");
    expect(json.isAnonymous).toBe(false);
  });

  it("still returns the score when holding it fails", async () => {
    const { pendingInsert } = setUpScoring(null);
    pendingInsert.mockResolvedValueOnce({ error: { message: "db down" } });

    const res = await POST(scoreRequest());
    expect(res.status).toBe(200);
    expect((await res.json()).score).toBe(70);
    expect(res.cookies.get("score_claim")).toBeUndefined();
  });
});
