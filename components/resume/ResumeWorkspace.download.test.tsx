// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ResumeWorkspace } from "./ResumeWorkspace";
import type { Resume } from "@/types";

// The editor is large and covered by its own tests; here it is only a button that starts a resume download.
vi.mock("@/components/resume/ResumeEditor", () => ({
  ResumeEditor: (props: { onDownload: (format: "pdf" | "docx") => void }) => (
    <button type="button" onClick={() => props.onDownload("pdf")}>
      resume editor download
    </button>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/ui/Toast", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

class InstantIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback([{ isIntersecting: true, target } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  unobserve() {}
  disconnect() {}
}

const resume = {
  id: "r1", job_title: "Data Analyst", company_name: "Brighte", template: "clean", font_size_pt: 10, skills_bridge_id: null,
  fact_check_flags: [], bridge_fact_check_flags: [], cover_letter_content: "Dear Hiring Manager,\n\nHello.",
  resume_content: {
    contact: { name: "Tia Julian", phone: "", email: "tia@example.com", location: "Sydney", linkedin: "", work_rights: "" },
    target_titles: [], summary: "", skills: [], tools: [], projects: [], education: [], referees: [], experience: [],
  },
} as unknown as Resume;

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", InstantIntersectionObserver);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]), json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  HTMLAnchorElement.prototype.click = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const renderWorkspace = (initialTab: "resume" | "cover-letter") =>
  render(<ResumeWorkspace resume={resume} isPaidPlan isResumeUnlocked isTrackedInitially={false} initialTab={initialTab} />);
const exports = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/generate-"));

describe("downloading from the workspace", () => {
  it("downloads the cover letter as a cover letter, with no resume-specific review dialog", async () => {
    renderWorkspace("cover-letter");
    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /PDF/ }));

    await waitFor(() => expect(exports()).toHaveLength(1));
    const [url, init] = exports()[0] as [string, RequestInit];
    expect(url).toBe("/api/generate-pdf");
    expect(JSON.parse(init.body as string)).toEqual({ resumeId: "r1", type: "cover-letter" });
    expect(screen.queryByText("Review before you export")).toBeNull();
  });

  it("sends the Word file to the docx endpoint, also as a cover letter", async () => {
    renderWorkspace("cover-letter");
    fireEvent.click(screen.getByRole("button", { name: "Download cover letter" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Word/ }));
    await waitFor(() => expect(exports()).toHaveLength(1));
    const [url, init] = exports()[0] as [string, RequestInit];
    expect(url).toBe("/api/generate-docx");
    expect(JSON.parse(init.body as string).type).toBe("cover-letter");
  });

  it("still asks the person to review the resume before its first export", () => {
    renderWorkspace("resume");
    fireEvent.click(screen.getByRole("button", { name: "resume editor download" }));
    expect(screen.getByText("Review before you export")).toBeInTheDocument();
    expect(exports()).toHaveLength(0);
  });
});
