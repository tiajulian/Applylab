import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), paid: vi.fn(), reserve: vi.fn(), refund: vi.fn(), rate: vi.fn(), score: vi.fn(), parse: vi.fn(),
  UnauthorizedError: class extends Error {}, PaidFeatureError: class extends Error {}, ContentScoreLimitReachedError: class extends Error {}, ScoreResumeCombinedError: class extends Error {} }));
vi.mock("@/lib/requireUser", () => ({ requirePermanentUser: mocks.auth, assertPaidPlan: mocks.paid, reserveContentScore: mocks.reserve, refundContentScore: mocks.refund,
  UnauthorizedError: mocks.UnauthorizedError, PaidFeatureError: mocks.PaidFeatureError, ContentScoreLimitReachedError: mocks.ContentScoreLimitReachedError, unauthorizedResponse: () => Response.json({}, { status: 401 }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ enforceRateLimit: mocks.rate }));
vi.mock("@/lib/anthropic/scoreResumeCombined", () => ({ scoreResumeCombined: mocks.score, ScoreResumeCombinedError: mocks.ScoreResumeCombinedError }));
vi.mock("@/lib/resume/parsedJobAdCache", () => ({ getOrParseCompactJobAd: mocks.parse }));
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { keywordContentKey } from "@/lib/resume/keywordScore";
import { keywordScoreHash } from "@/lib/resume/keywordScoreHash";
import { resumeScoreHash } from "@/lib/resume/resumeScoreHash";
import { POST } from "./route";

const content = sanitizeResumeContent({ summary: "Reporting analyst." });
let row: Record<string, unknown>;
let write: { eq: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> };
let update: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ appUser: { id: "user", plan: "pro" } });
  mocks.paid.mockReturnValue(undefined); mocks.reserve.mockResolvedValue(undefined); mocks.refund.mockResolvedValue(undefined); mocks.rate.mockResolvedValue(null);
  mocks.parse.mockResolvedValue({ must_have_skills: ["SQL"] });
  mocks.score.mockResolvedValue({ ats: { score: 0, missing_keywords: [] }, content: { score: 75, breakdown: {}, issues: [] } });
  row = { id: "resume", user_id: "user", job_description: "A job requiring SQL and reporting skills.", resume_content: content, ats_score: null, content_score: null, review_edit_token: "edit", review_job_ad_token: "ad" };
  const read = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: row })) };
  write = { eq: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: "resume" } }) };
  update = vi.fn(() => write);
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => read) } as never);
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);
});
function request(body: unknown = {}) { return POST(new Request("http://localhost/api/resume/resume/score", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "resume" }) }); }
describe("keyword comparison route", () => {
  it("does not spend a scoring use for a general resume", async () => {
    row.job_description = "";
    expect((await request()).status).toBe(422);
    expect(mocks.reserve).not.toHaveBeenCalled(); expect(mocks.score).not.toHaveBeenCalled();
  });
  it("refuses unsaved or stale client content before spending", async () => {
    expect((await request({ expectedContentKey: keywordContentKey({ ...content, summary: "Unsaved edit." }) })).status).toBe(409);
    expect(mocks.reserve).not.toHaveBeenCalled();
  });
  it("saves an assessed zero with ownership and content/ad concurrency checks", async () => {
    const response = await request({ expectedContentKey: keywordContentKey(content) });
    expect(response.status).toBe(200);
    expect(write.eq.mock.calls).toEqual([["id", "resume"], ["user_id", "user"], ["review_edit_token", "edit"], ["review_job_ad_token", "ad"]]);
    expect((await response.json()).scoredContentKey).toBe(keywordContentKey(content));
  });
  it("reuses only validated versioned cache results", async () => {
    Object.assign(row, { ats_score: 0, missing_keywords: [], ats_score_content_hash: keywordScoreHash(content, row.job_description as string), content_score: 75, content_score_content_hash: resumeScoreHash(content),
      content_score_breakdown: { impact: 70, clarity: 80, brevity: 80, completeness: 70 }, content_score_issues: [] });
    const response = await request();
    expect((await response.json()).fromCache).toBe(true); expect(mocks.reserve).not.toHaveBeenCalled();
    row.ats_score_content_hash = resumeScoreHash(content, row.job_description as string);
    expect((await request()).status).toBe(200); expect(mocks.score).toHaveBeenCalledTimes(1);
  });
  it("retries an incomplete cache rather than returning the same broken result", async () => {
    Object.assign(row, { ats_score: 0, missing_keywords: [], ats_score_content_hash: keywordScoreHash(content, row.job_description as string), content_score: 75, content_score_content_hash: resumeScoreHash(content), content_score_breakdown: {}, content_score_issues: [] });
    const response = await request();
    expect(response.status).toBe(200);
    expect((await response.json()).fromCache).toBe(false);
    expect(mocks.score).toHaveBeenCalledTimes(1);
  });
  it("refunds unusable job extraction and malformed assessments without persisting", async () => {
    mocks.parse.mockResolvedValueOnce({ title: "Analyst" });
    expect((await request()).status).toBe(502); expect(mocks.refund).toHaveBeenCalledTimes(1); expect(update).not.toHaveBeenCalled();
    mocks.score.mockRejectedValueOnce(new mocks.ScoreResumeCombinedError("Incomplete comparison"));
    expect((await request()).status).toBe(502); expect(mocks.refund).toHaveBeenCalledTimes(2);
  });
  it.each([{ data: null, error: null, status: 409 }, { data: null, error: { message: "Unavailable" }, status: 503 }])("refunds an unsuccessful save: $status", async ({ data, error, status }) => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      write.maybeSingle.mockResolvedValue({ data, error });
      expect((await request()).status).toBe(status); expect(mocks.refund).toHaveBeenCalledWith("user", "resume");
    } finally { quiet.mockRestore(); }
  });
  it("keeps plan gating separate from the scoring limit", async () => {
    mocks.paid.mockImplementationOnce(() => { throw new mocks.PaidFeatureError(); });
    expect((await request()).status).toBe(403);
    mocks.reserve.mockRejectedValueOnce(new mocks.ContentScoreLimitReachedError());
    expect((await request()).status).toBe(429); expect(mocks.score).not.toHaveBeenCalled();
  });
});
