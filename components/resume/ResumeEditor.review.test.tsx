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

function renderEditor(over: { isPaidPlan?: boolean; onDownload?: () => void; resume?: ResumeContent; profile?: ProfileSource } = {}) {
  const noop = vi.fn();
  return render(
    <ResumeEditor
      resumeId="r1" initialResumeContent={over.resume ?? content} profile={over.profile ?? profile} initialTemplate="clean" initialFontSizePt={10}
      isPaidPlan={over.isPaidPlan ?? false} initialFactCheckFlags={[]} initialBridgeFactCheckFlags={[]} skillsBridgeId={null}
      contentScore={null} contentScoreBreakdown={null} contentScoreIssues={[]} contentScoreCount={0}
      setContentScore={noop} setContentScoreBreakdown={noop} setContentScoreIssues={noop} setContentScoreCount={noop} setAtsScore={noop}
      isScoring={false} onScoreResume={noop} isUnlocked downloadingFormat={null} onDownload={over.onDownload ?? noop}
      onDownloadLocked={noop}
    />
  );
}

const chip = () => screen.getByRole("button", { name: /Review suggestions|No suggestions|Checking|All \d+ suggestions? reviewed/ });

describe("ResumeEditor review wiring", () => {
  it("never turns a bullet's own unbacked number into a review item - that honesty check is off, on request", async () => {
    // The bullet says 65%, which the profile's own description does not. This used to be a Verify
    // card; it is now just... the candidate's bullet, no different from any other.
    const { container } = renderEditor();
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 }); // the typo only
    expect(chip()).not.toHaveTextContent("verify");
    expect(screen.queryByText(/is not in your profile/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Download resume" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /pdf/i }));
    expect(screen.queryByText(/unverified/i)).toBeNull(); // no download warning either
  }, 20000);

  it("chip counts equal the highlighted passages, and a free user can apply a fix with undo", async () => {
    const { container } = renderEditor();
    expect(chip()).toHaveTextContent(/Checking/);

    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 }); // the typo only
    expect(container.querySelectorAll("mark")).toHaveLength(1);

    fireEvent.click(chip());
    const panel = screen.getByRole("dialog", { name: "Review suggestions" });
    expect(within(panel).getByText("0 of 1 reviewed")).toBeInTheDocument();
    expect(within(panel).getByText(/Possible spelling mistake: 'recieved'/)).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole("button", { name: "Apply fix" }));
    // The only item there is, so applying it finishes the whole review - the chip switches to its
    // "done" state text entirely rather than still showing a count (the panel's own count still does).
    await waitFor(() => expect(chip()).toHaveTextContent("All 1 suggestion reviewed"), { timeout: 5000 });
    expect(within(panel).getByText("1 of 1 reviewed")).toBeInTheDocument();
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.querySelector("textarea")?.value ?? "").toContain("received");

    fireEvent.click(within(panel.querySelector("ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 });
    expect(container.querySelectorAll("mark")).toHaveLength(1);
  }, 20000);

  it("dismissing a fix counts it as reviewed and drops the highlight, and Undo brings it back", async () => {
    const { container } = renderEditor();
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    // The only item there is, so dismissing it finishes the whole review - the chip switches to its
    // "done" state text entirely rather than still showing a count.
    await waitFor(() => expect(chip()).toHaveTextContent("All 1 suggestion reviewed"));
    await waitFor(() => expect(container.querySelectorAll("mark")).toHaveLength(0));

    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"));
    expect(container.querySelectorAll("mark")).toHaveLength(1);
  }, 20000);

  it("highlights the currently open card in the preview even when it's info-severity (a style fix, here - a reworded rewrite is never a card at all, see isRewordedInfo)", async () => {
    // Bullet text matches the profile's own wording exactly, so provenance never fires (no reworded/
    // new_claim item) - the only review item this produces is the buzzword fix, severity "info", which
    // isn't ambient-highlighted by default (see buildPassages/isCounted). Opening its card should still
    // mark its bullet, or there is nothing in the preview to say which part of the resume it's about.
    const buzzwordResume: ResumeContent = {
      ...content,
      summary: "",
      experience: [{ ...content.experience[0], bullets: ["Team player who cut report time using dbt."] }],
    };
    const buzzwordProfile: ProfileSource = {
      ...profile,
      work_experience: [{ ...profile.work_experience[0], description: "Team player who cut report time using dbt." }],
    };
    const { container } = renderEditor({ resume: buzzwordResume, profile: buzzwordProfile });
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 });
    expect(container.querySelectorAll("mark")).toHaveLength(0); // not ambient-highlighted before it's opened

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: /Fixes/ }));
    expect(await screen.findByText(/Buzzword: 'team player'/)).toBeInTheDocument();
    // Scoped to data-review-passage (the canvas highlight's own marker) - the open card also renders
    // its own <mark> around the flagged phrase in "Your original" (see ReviewCard's `flagged` branch),
    // which is a different, unrelated highlight this assertion isn't about.
    await waitFor(() => expect(container.querySelectorAll("[data-review-passage]")).toHaveLength(1));
  }, 20000);

  it("a mechanical fix from the integrity checks applies to the job title field, and Undo puts it back", async () => {
    const lowercaseTitle: ResumeContent = { ...content, experience: [{ ...content.experience[0], job_title: "analytics enginer" }] };
    const { container } = renderEditor({ resume: lowercaseTitle });
    await waitFor(() => expect(chip()).toHaveTextContent(/of \d+/), { timeout: 5000 });
    const fieldValues = () => Array.from(container.querySelectorAll("input, textarea")).map((el) => (el as HTMLInputElement).value);
    expect(fieldValues()).toContain("analytics enginer");

    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: /Fixes/ }));
    const row = screen.getAllByRole("button", { expanded: false }).find((b) => b.textContent?.includes("analytics enginer"))!;
    fireEvent.click(row);
    const card = document.querySelector('li[aria-current="true"]') as HTMLElement;
    // The card now shows what it would become, instead of only flagging the words.
    expect(within(card).getByText("Suggested").nextElementSibling).toHaveTextContent("Analytics Engineer");
    fireEvent.click(within(card).getByRole("button", { name: "Apply fix" }));

    await waitFor(() => expect(fieldValues()).toContain("Analytics Engineer"), { timeout: 5000 });
    expect(fieldValues()).not.toContain("analytics enginer");

    const list = document.querySelector("#review-panel ul") as HTMLElement;
    fireEvent.click(within(list).getAllByRole("button", { name: /^Undo: / })[0]);
    await waitFor(() => expect(fieldValues()).toContain("analytics enginer"), { timeout: 5000 });
  }, 30000);
});
