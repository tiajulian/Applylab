// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/analytics", () => ({ trackFunnelEvent: vi.fn() }));
vi.mock("@/components/interview/ProgressChart", () => ({ ProgressChart: () => null }));

const { InterviewSetup } = await import("./InterviewSetup");
const { PracticeHistory } = await import("./PracticeHistory");

const AD = "We are hiring a data analyst to build dashboards and report on sales. ".repeat(3);
const proUser = { id: "u1", plan: "pro", mic_consent_at: null } as never;
const resume = { id: "r1", job_title: "Analyst", company_name: "Rabobank", resume_content: null } as never;

describe("InterviewSetup job picker", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/parse-job-ad"
          ? { ok: true, json: async () => ({ title: "Data Analyst", company: "Acme" }) }
          : { ok: true, json: async () => ({ sessionId: "s1" }) }
      )
    );
    push.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("starts a job-ad-only practice with just the pasted ad", async () => {
    render(<InterviewSetup resumes={[resume]} user={proUser} profileSkillCount={3} />);
    expect(screen.getByRole("combobox", { name: "Resume" })).toHaveValue("r1");

    fireEvent.click(screen.getByRole("radio", { name: /Just the job ad/ }));
    expect(screen.queryByText("Your resume")).not.toBeInTheDocument();
    expect(screen.getByText(/Questions use this job ad and 3 skills from your profile/)).toBeInTheDocument();

    const start = screen.getAllByRole("button", { name: "Start practising" })[0];
    expect(start).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Job ad"), { target: { value: AD } });
    await waitFor(() => expect(screen.getByLabelText("Job title")).toHaveValue("Data Analyst"), { timeout: 3000 });
    expect(start).toBeEnabled();

    fireEvent.click(start);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/interview/s1"));
    const call = (fetch as any).mock.calls.find(([u]: [string]) => u === "/api/interview/sessions");
    const body = JSON.parse(call[1].body);
    expect(body).toMatchObject({ job_ad_only: true, job_title: "Data Analyst", company_name: "Acme", job_description: AD.trim() });
    expect(body).not.toHaveProperty("resume_id");
    expect(body).not.toHaveProperty("uploaded_resume_id");
  });

  it("needs a resume for 'My own resume'", () => {
    render(<InterviewSetup resumes={[resume]} user={proUser} />);
    fireEvent.click(screen.getByRole("radio", { name: /My own resume/ }));
    expect(screen.getByText("Your resume")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Job ad"), { target: { value: AD } });
    fireEvent.change(screen.getByLabelText("Job title"), { target: { value: "Analyst" } });
    expect(screen.getAllByRole("button", { name: "Start practising" })[0]).toBeDisabled();
  });

  it("sends free users to upgrade instead of switching", () => {
    render(<InterviewSetup resumes={[resume]} user={{ id: "u1", plan: "free", free_interviews_used: 0 } as never} />);
    fireEvent.click(screen.getByRole("radio", { name: /Just the job ad \(Pro\)/ }));
    expect(push).toHaveBeenCalledWith("/upgrade");
    expect(screen.getByRole("radio", { name: /An ApplyLab resume/ })).toHaveAttribute("aria-checked", "true");
  });
});

describe("PracticeHistory", () => {
  const base = { stageType: "general", coaching: false, canOpen: true, score: null } as const;
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const items = [
    { ...base, id: "a1", createdAt: recent, jobTitle: "Analyst", company: "Rabobank", status: "in_progress" as const },
    { ...base, id: "a2", createdAt: "2026-09-01T00:00:00Z", jobTitle: "Analyst", company: "Rabobank", status: "finished" as const, score: 3.6 },
    { ...base, id: "b1", createdAt: "2026-08-01T00:00:00Z", jobTitle: "Officer", company: "Example", status: "in_progress" as const },
  ];

  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true }))));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("groups by job, offers the recent unfinished one, and deletes from inside a job", async () => {
    render(<PracticeHistory items={items} page={1} pageCount={1} onStartFirst={() => {}} />);

    expect(await screen.findByText("Pick up where you left off")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Carry on" })).toHaveAttribute("href", "/interview/a1");

    const jobs = screen.getAllByRole("button", { expanded: false });
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toHaveTextContent("2 practices");

    fireEvent.click(jobs[0]);
    const panel = document.getElementById(jobs[0].getAttribute("aria-controls")!)!;
    expect(within(panel).getAllByRole("listitem")).toHaveLength(2);
    expect(within(panel).getByRole("link", { name: "Feedback" })).toHaveAttribute("href", "/interview/a2");

    fireEvent.click(within(panel).getAllByRole("button", { name: /Delete practice/ })[1]);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/interview/sessions/a2", { method: "DELETE" }));
    await waitFor(() => expect(screen.getAllByRole("button", { expanded: true })[0]).toHaveTextContent("1 practice"));
  });

  it("doesn't offer an unfinished practice over a week old", () => {
    render(<PracticeHistory items={[items[2]]} page={1} pageCount={1} onStartFirst={() => {}} />);
    expect(screen.queryByText("Pick up where you left off")).not.toBeInTheDocument();
    expect(screen.getByText("No score yet")).toBeInTheDocument();
  });
});
