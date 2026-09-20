// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { readFileSync } from "node:fs";
import nspell from "nspell";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ResumeEditor } from "./ResumeEditor";
import type { ResumeContent } from "@/types";
import type { ProfileSource } from "@/lib/review/provenance";

// Real en-AU dictionary, without the network fetch the browser build does.
vi.mock("@/lib/text/spellcheck", async (orig) => {
  const actual = await orig<typeof import("@/lib/text/spellcheck")>();
  const dir = "public/dictionaries/en-au";
  const checker = nspell(readFileSync(`${dir}/en-au.aff`, "utf8"), readFileSync(`${dir}/en-au.dic`, "utf8"));
  return { ...actual, getSpellChecker: async () => checker };
});

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const content: ResumeContent = {
  contact: { name: "Sam Lee", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "I recieved great feedback and organise events.", skills: [], tools: ["Data: dbt"],
  projects: [], education: [], referees: [],
  experience: [{ job_title: "Analytics Engineer", company: "Acme", company_description: "", location: "", start_date: "2021", end_date: "2024",
    bullets: ["Cut report time by 65% with dbt."] }],
};
const profile: ProfileSource = {
  work_experience: [{ job_title: "Analytics Engineer", company: "Acme", location: "", start_date: "2021", end_date: "2024", is_current: false, wins: [],
    description: "Cut report time using dbt." }],
  projects: [], education: [], skills: [], tools: ["dbt"], raw_linkedin_paste: null,
};

function renderEditor(over: { isPaidPlan?: boolean; onDownload?: () => void } = {}) {
  const noop = vi.fn();
  return render(
    <ResumeEditor
      resumeId="r1" initialResumeContent={content} profile={profile} initialTemplate="clean" initialFontSizePt={10}
      isPaidPlan={over.isPaidPlan ?? false} initialFactCheckFlags={[]} initialBridgeFactCheckFlags={[]} skillsBridgeId={null}
      contentScore={null} contentScoreBreakdown={null} contentScoreIssues={[]} contentScoreCount={0}
      setContentScore={noop} setContentScoreBreakdown={noop} setContentScoreIssues={noop} setContentScoreCount={noop} setAtsScore={noop}
      isScoring={false} onScoreResume={noop} isUnlocked downloadingFormat={null} onDownload={over.onDownload ?? noop}
      onDownloadLocked={noop}
    />
  );
}

const chip = () => screen.getByRole("button", { name: /Review suggestions|No suggestions|Checking|All \d+ suggestions reviewed/ });

describe("ResumeEditor review wiring", () => {
  it("chip counts equal the highlighted passages, and a free user can apply a fix with undo", async () => {
    const { container } = renderEditor();
    expect(chip()).toHaveTextContent(/Checking/);

    // typo (warn) + unverified 65% (verify): two suggestions, none reviewed, one to verify
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 2"), { timeout: 5000 });
    expect(chip()).toHaveTextContent("1 to verify");
    expect(container.querySelectorAll("mark")).toHaveLength(2);

    fireEvent.click(chip());
    const panel = screen.getByRole("dialog", { name: "Review suggestions" });
    expect(within(panel).getByText("0 of 2 reviewed")).toBeInTheDocument();
    // Opens on the urgent verify item, saying what is new.
    expect(within(panel).getByText(/'65%' is not in your profile/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Fixes/ }));
    expect(within(panel).getByText(/Possible spelling mistake: 'recieved'/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Apply fix" }));
    await waitFor(() => expect(chip()).toHaveTextContent("1 of 2"), { timeout: 5000 });
    expect(container.querySelectorAll("mark")).toHaveLength(1);
    expect(container.querySelector("textarea")?.value ?? "").toContain("received");

    // The Fixes tab is finished, so the panel moved on to Rewrites; the applied fix waits in its own tab.
    fireEvent.click(screen.getByRole("button", { name: /Fixes/ }));
    fireEvent.click(within(panel.querySelector("ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 2"), { timeout: 5000 });
    expect(container.querySelectorAll("mark")).toHaveLength(2);
  }, 20000);

  it("dismissing a fix counts it as reviewed and drops the highlight, and Undo brings it back", async () => {
    const { container } = renderEditor();
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 2"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: /Fixes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(chip()).toHaveTextContent("1 of 2"));
    expect(container.querySelectorAll("mark")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: /Fixes/ }));
    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 2"));
    expect(container.querySelectorAll("mark")).toHaveLength(2);
  }, 20000);

  it("prompts, without blocking, when downloading with an open verify item", async () => {
    const onDownload = vi.fn();
    renderEditor({ onDownload });
    await waitFor(() => expect(chip()).toHaveTextContent("1 to verify"), { timeout: 5000 });
    fireEvent.click(screen.getByRole("button", { name: "Download resume" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /pdf/i }));
    expect(await screen.findByText(/AI-added claim is unverified/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Download anyway" }));
    expect(onDownload).toHaveBeenCalled();
  }, 20000);

  it("Keep original restores the profile wording through History; Accept on a new claim persists across a reload", async () => {
    const first = renderEditor();
    await waitFor(() => expect(chip()).toHaveTextContent("1 to verify"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "Keep original" }));
    await waitFor(() => expect(chip()).toHaveTextContent("1 of 2"), { timeout: 5000 });
    expect(chip()).not.toHaveTextContent("verify");
    expect(Array.from(first.container.querySelectorAll("textarea")).some((t) => t.value === "Cut report time using dbt.")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Rewrites/ }));
    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: Experience/ }));
    await waitFor(() => expect(chip()).toHaveTextContent("1 to verify"), { timeout: 5000 });
    expect(chip()).toHaveTextContent("0 of 2");

    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(chip()).toHaveTextContent("1 of 2"), { timeout: 5000 });
    expect(chip()).not.toHaveTextContent("verify");
    first.unmount();

    renderEditor();
    await waitFor(() => expect(chip()).toHaveTextContent("1 of 2"), { timeout: 5000 });
    expect(chip()).not.toHaveTextContent("verify");
  }, 30000);
});
