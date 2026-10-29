import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeContent, ResumeReviewCategory, ResumeReviewResult } from "@/types";
import { resumeReviewHash } from "@/lib/resume/reviewCache";

const { requireUser, reserve, markReserved, refund, rateLimit, UnauthorizedError, FreeTierFeatureLimitReachedError } = vi.hoisted(() => ({
  requireUser: vi.fn(), reserve: vi.fn(), markReserved: vi.fn(), refund: vi.fn(), rateLimit: vi.fn(),
  UnauthorizedError: class extends Error {}, FreeTierFeatureLimitReachedError: class extends Error {},
}));
vi.mock("@/lib/requireUser", () => ({
  requireUser, requirePermanentUser: requireUser, UnauthorizedError, FreeTierFeatureLimitReachedError,
  reserveFreeTierFeature: reserve,
  trackFreeTierReservation: () => ({ markReserved, refundIfReserved: refund }),
  unauthorizedResponse: () => Response.json({ error: "Unauthorized" }, { status: 401 }),
  freeTierLimitReachedResponse: () => Response.json({ code: "FREE_LIMIT_REACHED" }, { status: 403 }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/resume/parsedJobAdCache", () => ({ getOrParseCompactJobAd: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ checkAndRecordRateLimit: rateLimit }));
vi.mock("@/lib/resume/reviewSpelling", () => ({ withReviewSpelling: async (_content: unknown, findings: unknown) => findings }));
vi.mock("@/lib/resume/scoreReview", () => ({
  scoreResumeReview: vi.fn(),
  sanitizeReviewForPlan: (review: ResumeReviewResult, unlocked: boolean) => ({ ...review, unlocked }),
}));

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { scoreResumeReview } from "@/lib/resume/scoreReview";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { GET, POST } from "./route";

const content: ResumeContent = {
  contact: { name: "Sam Lee", email: "sam@example.com", phone: "0400000000", location: "Sydney", linkedin: "", work_rights: "" },
  target_titles: ["Analyst"], summary: "Reporting analyst.", skills: ["SQL"], tools: ["Excel"], projects: [], education: [], referees: [],
  experience: [{ job_title: "Analyst", company: "Acme", company_description: "", location: "", start_date: "2022", end_date: "Present", bullets: ["Prepared weekly reports."] }],
};
const categories: ResumeReviewCategory[] = [
  { key: "ats_structure", label: "Structure", score: 20, max_points: 20, assessment: "basic", locked: false, finding_count: 0 },
  { key: "content_quality", label: "Content", score: 24, max_points: 30, assessment: "ai", locked: false, finding_count: 0 },
  { key: "writing_quality", label: "Writing", score: 16, max_points: 20, assessment: "ai", locked: false, finding_count: 0 },
  { key: "application_readiness", label: "Readiness", score: 15, max_points: 15, assessment: "basic", locked: false, finding_count: 0 },
  { key: "job_optimization", label: "Match", score: 12, max_points: 15, assessment: "ai", locked: false, finding_count: 0 },
];
const job = { title: "Analyst", company: "Acme", seniority: "", must_have_skills: ["SQL"], nice_to_have_skills: [], tools: [], key_responsibilities: [], keywords: [], notable_context: [] };
let row: Record<string, unknown>;
let result: ResumeReviewResult;
let read: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn> };
let write: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> };
let update: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  row = { id: "res-1", user_id: "user-1", resume_content: structuredClone(content), job_description: "Analyst role requiring SQL and weekly reports.", review_edit_token: "edit-token", review_job_ad_token: "job-ad-token", review_overall_score: null };
  result = { overall_score: 88, categories: structuredClone(categories), findings: [], content_hash: "provider-hash", scored_at: "2026-10-29T00:00:00Z", unlocked: true };
  requireUser.mockResolvedValue({ appUser: { id: "user-1", plan: "pro" } });
  reserve.mockResolvedValue(undefined);
  refund.mockResolvedValue(undefined);
  rateLimit.mockResolvedValue(true);
  vi.mocked(getOrParseCompactJobAd).mockResolvedValue(structuredClone(job));
  vi.mocked(scoreResumeReview).mockImplementation(async () => structuredClone(result));
  read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: row, error: null })) };
  write = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "res-1" }, error: null }) };
  update = vi.fn(() => write);
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => read) } as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);
});
function request(method = "POST") {
  const req = new Request("http://localhost/api/resume/res-1/review", { method });
  return (method === "GET" ? GET : POST)(req, { params: Promise.resolve({ id: "res-1" }) });
}
function cache() {
  Object.assign(row, {
    review_overall_score: result.overall_score, review_categories: result.categories, review_findings: [],
    review_content_hash: resumeReviewHash(content, String(row.job_description)), review_scored_at: result.scored_at,
  });
}

describe("review reads", () => {
  it("requires authentication", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError());
    expect((await request("GET")).status).toBe(401);
  });
  it("marks a changed job ad as stale even when the resume is unchanged", async () => {
    cache();
    row.job_description = "Another job requiring Python.";
    expect((await (await request("GET")).json()).isStale).toBe(true);
  });
  it("recognises the current content and job ad", async () => {
    cache();
    expect((await (await request("GET")).json()).isStale).toBe(false);
  });
});
describe("review scoring and retries", () => {
  it("stores the versioned content/job hash and guards concurrent edits", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.review.content_hash).toBe(resumeReviewHash(content, String(row.job_description)));
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ review_content_hash: body.review.content_hash }));
    expect(write.eq).toHaveBeenCalledWith("review_edit_token", "edit-token");
    expect(write.eq).toHaveBeenCalledWith("review_job_ad_token", "job-ad-token");
    expect(write.eq).not.toHaveBeenCalledWith("job_description", expect.anything());
    expect(write.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(markReserved).toHaveBeenCalledWith("user-1");
    expect(refund).not.toHaveBeenCalled();
  });
  it("reuses a complete matching review without spending another use", async () => {
    cache();
    expect((await (await request()).json()).fromCache).toBe(true);
    expect(scoreResumeReview).not.toHaveBeenCalled();
    expect(reserve).not.toHaveBeenCalled();
  });
  it("recomputes a review for a changed job ad", async () => {
    cache();
    row.job_description = "Different analyst role requiring SQL.";
    expect((await (await request()).json()).fromCache).toBe(false);
    expect(scoreResumeReview).toHaveBeenCalledOnce();
  });
  it("does not reuse a review made before assessment status was recorded", async () => {
    cache();
    row.review_categories = categories.map(({ assessment: _assessment, ...c }) => c);
    await request();
    expect(scoreResumeReview).toHaveBeenCalledOnce();
  });
  it("retries a cached basic result and refunds an incomplete attempt", async () => {
    result.categories = categories.map((c) => ({ ...c, assessment: c.key === "job_optimization" ? "not_assessed" : "basic" }));
    cache();
    expect((await request()).status).toBe(200);
    expect(scoreResumeReview).toHaveBeenCalledOnce();
    expect(refund).toHaveBeenCalledOnce();
  });
  it("does not lock an unavailable job match into the cache", async () => {
    result.categories = categories.map((c) => c.key === "job_optimization" ? { ...c, score: 0, assessment: "not_assessed" } : c);
    cache();
    vi.mocked(getOrParseCompactJobAd).mockRejectedValueOnce(new Error("Provider unavailable"));
    expect((await request()).status).toBe(200);
    expect(vi.mocked(scoreResumeReview).mock.calls[0][1]).toBeNull();
    expect(refund).toHaveBeenCalledOnce();
  });
  it("treats an empty parsed job ad as unassessed", async () => {
    vi.mocked(getOrParseCompactJobAd).mockResolvedValueOnce({ ...job, must_have_skills: [], title: "", company: "" });
    result.categories = categories.map((c) => c.key === "job_optimization" ? { ...c, score: 0, assessment: "not_assessed" } : c);
    await request();
    expect(vi.mocked(scoreResumeReview).mock.calls[0][1]).toBeNull();
    expect(refund).toHaveBeenCalledOnce();
  });
  it("can reuse a complete quality review without a job ad", async () => {
    row.job_description = "";
    result.categories = categories.map((c) => c.key === "job_optimization" ? { ...c, score: 0, assessment: "not_assessed" } : c);
    cache();
    expect((await (await request()).json()).fromCache).toBe(true);
  });
  it("refunds a save conflict and does not report the review as saved", async () => {
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await request()).status).toBe(409);
    expect(refund).toHaveBeenCalledOnce();
  });
  it("refunds a database save failure", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    write.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Offline" } });
    expect((await request()).status).toBe(503);
    expect(refund).toHaveBeenCalledOnce();
    quiet.mockRestore();
  });
  it("does not spend tokens before the save-token migration is installed", async () => {
    delete row.review_edit_token;
    expect((await request()).status).toBe(503);
    expect(reserve).not.toHaveBeenCalled();
    expect(scoreResumeReview).not.toHaveBeenCalled();
  });
  it("enforces the hourly limit before reserving a free use", async () => {
    rateLimit.mockResolvedValueOnce(false);
    expect((await request()).status).toBe(429);
    expect(reserve).not.toHaveBeenCalled();
  });
  it("enforces the account cap before calling the provider", async () => {
    reserve.mockRejectedValueOnce(new FreeTierFeatureLimitReachedError());
    expect((await request()).status).toBe(403);
    expect(markReserved).not.toHaveBeenCalled();
    expect(scoreResumeReview).not.toHaveBeenCalled();
  });
});
