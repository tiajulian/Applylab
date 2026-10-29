import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

const { requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError } = vi.hoisted(() => ({
  requireUser: vi.fn(), assertPaidPlan: vi.fn(), UnauthorizedError: class extends Error {}, PaidFeatureError: class extends Error {},
}));
vi.mock("@/lib/requireUser", () => ({ requireUser, assertPaidPlan, UnauthorizedError, PaidFeatureError }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(), createServiceRoleClient: vi.fn() }));
vi.mock("@/lib/resume/versions", () => ({ saveVersionSnapshot: vi.fn() }));
vi.mock("@/lib/resume/reviewSpelling", () => ({ withReviewSpelling: vi.fn(async (_content, findings) => findings) }));

import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import { POST } from "./route";
import { resumeReviewHash } from "@/lib/resume/reviewCache";

const content: ResumeContent = {
  contact: { name: "Sam Lee", email: "", phone: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "Experienced analyst.", skills: [], tools: [], education: [], referees: [], projects: [],
  experience: [{ job_title: "Analyst", company: "Acme", company_description: "", location: "", start_date: "2022", end_date: "Present", bullets: ["Prepared reports."] }],
};
const finding: ResumeReviewFinding = {
  id: "finding-1", title: "Add detail", category_key: "content_quality", severity: "warning", status: "open",
  bullet_text: "Prepared reports.", target: { kind: "experienceBullet", index: 0, bulletIndex: 0 },
};
let row: { id: string; user_id: string; resume_content: ResumeContent; review_findings: ResumeReviewFinding[]; review_edit_token?: string; review_content_hash?: string; job_description?: string };
let selectQuery: { select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; single: ReturnType<typeof vi.fn> };
let writeQuery: { eq: ReturnType<typeof vi.fn>; is: ReturnType<typeof vi.fn>; select: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> };
let update: ReturnType<typeof vi.fn>;
let patch: Record<string, unknown>;

beforeEach(() => {
  vi.resetAllMocks();
  requireUser.mockResolvedValue({ appUser: { id: "user-1", plan: "pro" } });
  vi.mocked(saveVersionSnapshot).mockResolvedValue(true);
  row = { id: "res-1", user_id: "user-1", resume_content: structuredClone(content), review_findings: [structuredClone(finding)], review_edit_token: "initial-token" };
  selectQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn(async () => ({ data: row, error: null })) };
  vi.mocked(createClient).mockReturnValue({ from: vi.fn(() => selectQuery) } as never);
  writeQuery = {
    eq: vi.fn().mockReturnThis(), is: vi.fn().mockReturnThis(), select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: { ...row, ...patch }, error: null })),
  };
  update = vi.fn((value) => { patch = value; return writeQuery; });
  vi.mocked(createServiceRoleClient).mockReturnValue({ from: vi.fn(() => ({ update })) } as never);
});

function request(extra: Record<string, unknown> = {}) {
  return POST(new Request("http://localhost/api/resume/res-1/review/apply-fix", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ findingId: "finding-1", fixText: "Prepared weekly reports.", expectedText: "Prepared reports.", ...extra }),
  }), { params: Promise.resolve({ id: "res-1" }) });
}

describe("review actions", () => {
  it("marks the review stale if the job ad changes while an action is saved", async () => {
    row.job_description = "Original job advertisement";
    row.review_content_hash = resumeReviewHash(row.resume_content, row.job_description);
    writeQuery.maybeSingle.mockImplementation(async () => ({ data: { ...row, ...patch, job_description: "Changed job advertisement" }, error: null }));
    const response = await request({ action: "dismiss" });
    expect(response.status).toBe(200);
    expect((await response.json()).isStale).toBe(true);
  });
  it("requires authentication and a paid plan", async () => {
    requireUser.mockRejectedValueOnce(new UnauthorizedError());
    expect((await request()).status).toBe(401);
    assertPaidPlan.mockImplementationOnce(() => { throw new PaidFeatureError(); });
    expect((await request()).status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });
  it("checks ownership in both reads and writes", async () => {
    expect((await request()).status).toBe(200);
    expect(selectQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(writeQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
  it("stores exact before/after text for undo, without changing unrelated text", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.resume.resume_content.experience[0].bullets).toEqual(["Prepared weekly reports."]);
    expect(result.resume.resume_content.summary).toBe(content.summary);
    expect(result.findings[0]).toMatchObject({
      status: "applied", review_change: { blockId: "experienceBullet:0:0", before: "Prepared reports.", after: "Prepared weekly reports." },
    });
    expect(saveVersionSnapshot).toHaveBeenCalledOnce();
    expect(writeQuery.eq).toHaveBeenCalledWith("review_edit_token", "initial-token");
  });
  it("ignores client target pointers and uses the saved finding", async () => {
    const response = await request({ target: { kind: "summary" }, bulletText: content.summary });
    const result = await response.json();
    expect(result.resume.resume_content.summary).toBe(content.summary);
    expect(result.resume.resume_content.experience[0].bullets[0]).toBe("Prepared weekly reports.");
  });
  it("rejects unknown findings and stale source text", async () => {
    expect((await request({ findingId: "made-up" })).status).toBe(409);
    expect((await request({ expectedText: "Old text." })).status).toBe(409);
    row.resume_content.experience[0].bullets[0] = "An edit made elsewhere.";
    expect((await request()).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects unresolved blanks, oversized text, empty text and missing preview", async () => {
    expect((await request({ fixText: "Prepared [add number] reports." })).status).toBe(400);
    expect((await request({ fixText: "a".repeat(10001) })).status).toBe(400);
    expect((await request({ fixText: " " })).status).toBe(400);
    expect((await request({ expectedText: undefined })).status).toBe(400);
    expect((await request({ fixText: "Prepared reports." })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });
  it("keeps original wording without writing resume content or taking a snapshot", async () => {
    const response = await request({ action: "dismiss", fixText: undefined });
    expect(response.status).toBe(200);
    expect(patch).not.toHaveProperty("resume_content");
    expect((await response.json()).findings[0].status).toBe("dismissed");
    expect(saveVersionSnapshot).not.toHaveBeenCalled();
  });
  it("can undo keeping the original", async () => {
    row.review_findings[0].status = "dismissed";
    const response = await request({ action: "undo" });
    expect(response.status).toBe(200);
    expect((await response.json()).findings[0].status).toBe("open");
    expect(patch).not.toHaveProperty("resume_content");
  });
  it("undoes an applied change without overwriting unrelated edits", async () => {
    row.resume_content.experience[0].bullets[0] = "Prepared weekly reports.";
    row.resume_content.summary = "Another saved edit.";
    row.review_findings = [{
      ...finding, status: "applied",
      ...{ review_change: { blockId: "experienceBullet:0:0", before: "Prepared reports.", after: "Prepared weekly reports." } },
    }];
    const response = await request({ action: "undo" });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.resume.resume_content.experience[0].bullets[0]).toBe("Prepared reports.");
    expect(result.resume.resume_content.summary).toBe("Another saved edit.");
    expect(result.findings[0].status).toBe("open");
  });
  it("refuses undo if the changed field has since been edited", async () => {
    row.review_findings = [{
      ...finding, status: "applied",
      ...{ review_change: { blockId: "experienceBullet:0:0", before: "Old.", after: "No longer current." } },
    }];
    expect((await request({ action: "undo" })).status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
  it("rejects repeated actions and invalid action names", async () => {
    row.review_findings[0].status = "applied";
    expect((await request()).status).toBe(409);
    expect((await request({ action: "delete" })).status).toBe(400);
    expect((await request({ action: ["apply"] })).status).toBe(400);
  });
  it("does not write when the backup fails", async () => {
    vi.mocked(saveVersionSnapshot).mockResolvedValue(false);
    expect((await request()).status).toBe(503);
    expect(update).not.toHaveBeenCalled();
  });
  it("does not write before the save-token migration is installed", async () => {
    delete row.review_edit_token;
    expect((await request()).status).toBe(503);
    expect(update).not.toHaveBeenCalled();
  });
  it("reports a conflict if another writer won the compare-and-swap", async () => {
    writeQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    expect((await request()).status).toBe(409);
  });
  it("reports database save failures without claiming success", async () => {
    writeQuery.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "Database unavailable" } });
    expect((await request()).status).toBe(500);
  });
  it("returns 404 if the owned resume cannot be read", async () => {
    selectQuery.single.mockResolvedValueOnce({ data: null, error: null });
    expect((await request()).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});
