// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { ResumeWorkspace } from "./ResumeWorkspace";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { keywordContentKey } from "@/lib/resume/keywordScore";
import type { Resume } from "@/types";
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock("@/components/resume/ResumeEditor", () => ({ ResumeEditor: (props: ComponentProps<typeof import("./ResumeEditor").ResumeEditor>) => <>
  <button onClick={() => props.onScoreResume(props.initialResumeContent)}>Run comparison</button>
  <output data-testid="comparison">{JSON.stringify({ score: props.atsScore, snapshot: props.atsScoredContentKey })}</output>
</> }));
const content = sanitizeResumeContent({ summary: "Analyst." });
const row = { id: "resume", job_title: "Analyst", company_name: "Acme", resume_content: content, job_description: "A SQL reporting job.", ats_score: 0,
  missing_keywords: [], content_score: 75, content_score_count: 1, content_score_issues: [], fact_check_flags: [], bridge_fact_check_flags: [] } as unknown as Resume;
let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  push.mockClear(); fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("IntersectionObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function view(resume = row) { render(<ResumeWorkspace resume={resume} initialKeywordScoreCurrent isPaidPlan isTrackedInitially={false} />); }
const scoreResponse = { ats: { score: 0, missing_keywords: [] }, content: { score: 75, breakdown: { impact: 70, clarity: 80, brevity: 80, completeness: 70 }, issues: [] },
  scoredContentKey: keywordContentKey({ ...content, summary: "Snapshot assessed on server." }), jobDescription: row.job_description, fromCache: false };
describe("workspace comparison requests", () => {
  it.each([{ status: 409, code: "CONTENT_CHANGED" }, { status: 422, code: "JOB_AD_REQUIRED" }])("invalidates the old assessment after a confirmed server context change: $status", async ({ status, code }) => {
    fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({ code, error: "The comparison context changed." }) });
    view(); fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    await screen.findByText("The comparison context changed.");
    expect(JSON.parse(screen.getByTestId("comparison").textContent!)).toEqual({ score: 0, snapshot: null });
  });
  it("blocks duplicate clicks and uses the returned snapshot even when scores are unchanged", async () => {
    let resolve!: (value: unknown) => void;
    fetchMock.mockReturnValue(new Promise((done) => { resolve = done; }));
    view();
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ expectedContentKey: keywordContentKey(content) });
    resolve({ ok: true, json: async () => scoreResponse });
    await waitFor(() => expect(screen.getByTestId("comparison")).toHaveTextContent(JSON.stringify({ score: 0, snapshot: scoreResponse.scoredContentKey })));
  });
  it("keeps the previous result after a malformed success response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ats: { score: 0 } }) });
    view(); const previous = screen.getByTestId("comparison").textContent;
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    await screen.findByText(/couldn't read the comparison/);
    expect(screen.getByTestId("comparison").textContent).toBe(previous);
  });
  it("does not redirect a paid user to upgrade for a scoring-limit error", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429, json: async () => ({ error: "Scoring limit reached", code: "SCORE_LIMIT_REACHED" }) });
    view(); fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    await screen.findByText("Scoring limit reached"); expect(push).not.toHaveBeenCalled();
  });
  it("does not call the comparison endpoint without a job ad", () => {
    view({ ...row, job_description: "" });
    fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Attach a job ad before checking keyword match/)).toBeInTheDocument();
  });
});
