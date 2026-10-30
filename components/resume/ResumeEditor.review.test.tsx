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
  it.each([
    "Built technical solutions for finance.",
    "Built **technical** solutions for *finance*.",
  ])("applies a grounded guided fix, autosaves it and restores the exact original: %s", async (original) => {
    const resume = { ...content, summary: "", experience: [{ ...content.experience[0], bullets: [original] }] };
    const source = { ...profile, work_experience: [{ ...profile.work_experience[0], description: "Built dashboards for finance." }] };
    const { container } = renderEditor({ resume, profile: source });
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "dashboards" }));
    const card = document.querySelector('li[aria-current="true"]') as HTMLElement;
    expect(within(card).getByText("Suggested").nextElementSibling).toHaveTextContent("Built dashboards for finance.");
    fireEvent.click(within(card).getByRole("button", { name: "Apply fix" }));
    const bullet = () => container.querySelector<HTMLElement>('[contenteditable="true"][data-fc-target="experienceBullet:0:0"]')!;
    await waitFor(() => expect(bullet()).toHaveTextContent("Built dashboards for finance."));
    const savedBullets = () => vi.mocked(fetch).mock.calls.filter(([url, init]) => url === "/api/resume/r1" && init?.method === "PATCH")
      .map(([, init]) => JSON.parse(init!.body as string).resume_content.experience[0].bullets[0]);
    await waitFor(() => expect(savedBullets().length).toBeGreaterThan(0), { timeout: 5000 });
    expect(savedBullets().at(-1)).toContain("dashboards");
    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"));
    await waitFor(() => expect(savedBullets().at(-1)).toBe(original), { timeout: 5000 });
    expect(bullet()).toHaveTextContent("Built technical solutions for finance.");
    expect(screen.getByText("What did you build?")).toBeInTheDocument();
  }, 20000);

  it("does not borrow grounded chips from a different title at the same employer", async () => {
    const resume = { ...content, summary: "", experience: [{ ...content.experience[0], bullets: ["Built technical solutions for finance."] }] };
    const source = { ...profile, work_experience: [{ ...profile.work_experience[0], job_title: "Data Analyst", description: "Built Tableau dashboards." }] };
    renderEditor({ resume, profile: source });
    await waitFor(() => expect(chip()).not.toHaveTextContent("Checking"), { timeout: 5000 });
    fireEvent.click(chip());
    expect(screen.getByRole("button", { name: "Something else" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tableau dashboards/ })).toBeNull();
  }, 20000);

  it("refuses stale Undo without removing later canvas edits or announcing success", async () => {
    const resume = { ...content, summary: "", experience: [{ ...content.experience[0], bullets: ["Built technical solutions for finance."] }] };
    const source = { ...profile, work_experience: [{ ...profile.work_experience[0], description: "Built dashboards for finance." }] };
    const { container } = renderEditor({ resume, profile: source });
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "dashboards" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
    const bullet = container.querySelector<HTMLElement>('[contenteditable="true"][data-fc-target="experienceBullet:0:0"]')!;
    fireEvent.focus(bullet);
    bullet.textContent = "Built dashboards for the finance team.";
    fireEvent.input(bullet);
    fireEvent.blur(bullet);
    await waitFor(() => expect(bullet).toHaveTextContent("Built dashboards for the finance team."));
    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: / }));
    expect(bullet).toHaveTextContent("Built dashboards for the finance team.");
    expect(document.querySelector('#review-panel [role="status"]')).not.toHaveTextContent("Undone");
    expect(screen.getByText("This text has changed. Undo the later edits first.")).toBeVisible();
  }, 20000);

  it("moves an out-of-order role into place from its card and puts it back on Undo", async () => {
    const role = (job_title: string, start_date: string, end_date: string) => ({ ...content.experience[0], job_title, start_date, end_date });
    const resume = { ...content, summary: "", experience: [role("Barista", "2019", "2021"), role("Data Analyst", "Dec 2024", "May 2026")] };
    renderEditor({ resume });
    await waitFor(() => expect(chip()).not.toHaveTextContent("Checking"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: /^Fixes/ }));
    const titles = () => screen.getAllByRole("textbox", { name: "Job title" }).map((el) => (el as HTMLInputElement).value);
    const scrolled = vi.mocked(window.HTMLElement.prototype.scrollIntoView);
    scrolled.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Show on resume" }));
    await waitFor(() => expect(scrolled).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Move role up/ }));
    await waitFor(() => expect(titles()).toEqual(["Data Analyst", "Barista"]));
    await waitFor(() => expect(document.querySelector("#review-panel ul")).toHaveTextContent("Accepted · Data Analyst"));
    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(titles()).toEqual(["Barista", "Data Analyst"]));
  }, 20000);

  it("opens the real date field when a composite-date guided card asks for an edit", async () => {
    const resume = { ...content, summary: "", experience: [{ ...content.experience[0], start_date: "2099", end_date: "Present" }] };
    renderEditor({ resume });
    await waitFor(() => expect(chip()).not.toHaveTextContent("Checking"), { timeout: 5000 });
    fireEvent.click(chip());
    expect(screen.getByText("Is this correct?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit it" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Start date" })).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Save and accept" })).toBeNull();
  }, 20000);

  it("keeps a custom draft through full editing and Decide later, then clears it after Keep and Undo", async () => {
    const original = "Built technical solutions for finance.";
    const resume = { ...content, summary: "", experience: [{ ...content.experience[0], bullets: [original] }] };
    renderEditor({ resume });
    await waitFor(() => expect(chip()).toHaveTextContent("0 of 1"), { timeout: 5000 });
    fireEvent.click(chip());
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your wording" }), { target: { value: "reporting dashboards" } });
    fireEvent.click(screen.getByRole("button", { name: "Edit wording" }));
    expect(screen.getByRole("textbox", { name: "Edit wording" })).toHaveValue("Built reporting dashboards for finance.");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("textbox", { name: "Your wording" })).toHaveValue("reporting dashboards");
    fireEvent.click(screen.getByRole("button", { name: "Decide later" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Your wording" })).toHaveValue("reporting dashboards"));
    fireEvent.click(screen.getByRole("button", { name: "Keep as is" }));
    await waitFor(() => expect(chip()).toHaveTextContent("All 1 suggestion reviewed"));
    fireEvent.click(within(document.querySelector("#review-panel ul")!).getByRole("button", { name: /^Undo: / }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Something else" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Apply fix" })).toBeDisabled();
  }, 20000);

  it("does not flag earned scope wording in the editor", async () => {
    const bullet = "Owned the end-to-end pipeline for a new vendor accreditation program using dbt, Snowflake, and Tableau, reducing vendor accreditation time from 6.8 days to 1.4 days.";
    const resume = { ...content, summary: "", experience: [{ ...content.experience[0], bullets: [bullet] }] };
    renderEditor({ resume });
    await waitFor(() => expect(chip()).not.toHaveTextContent("Checking"), { timeout: 5000 });
    expect(chip()).toHaveTextContent("No suggestions");
    expect(screen.queryByText(/Job-ad wording|Cut the fluff/)).toBeNull();
  }, 20000);

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
    fireEvent.click(screen.getByRole("button", { name: "Keep as is" }));
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
    expect(await screen.findByText("What did you do that shows this?")).toBeInTheDocument();
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
