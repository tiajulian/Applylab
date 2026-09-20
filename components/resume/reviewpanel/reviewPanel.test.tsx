// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { chipLabel, chipState, ReviewChip } from "./ReviewChip";
import { ReviewPanelDemo } from "./ReviewPanelDemo";
import { SAMPLE_TEXTS, sampleItems } from "./sampleReview";
import type { ReviewProgress } from "@/lib/review/progress";

beforeEach(() => {
  vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
  })));
  // jsdom has no scrollIntoView.
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const progress = (over: Partial<ReviewProgress> = {}): ReviewProgress => ({ total: 8, reviewed: 0, accepted: 0, kept: 0, verify: 2, ...over });

describe("entry chip", () => {
  it("is idle before the first check, checking during it, and clear when nothing was suggested", () => {
    expect(chipState("idle", { total: 0, reviewed: 0 })).toBe("idle");
    expect(chipState("checking", { total: 8, reviewed: 3 })).toBe("checking");
    expect(chipState("ready", { total: 0, reviewed: 0 })).toBe("clear");
    expect(chipState("ready", { total: 8, reviewed: 8 })).toBe("done");
  });

  it("separates not started from in progress, and reads the counts as one sentence", () => {
    expect(chipState("ready", { total: 8, reviewed: 0 })).toBe("notStarted");
    expect(chipState("ready", { total: 8, reviewed: 3 })).toBe("inProgress");
    expect(chipLabel("inProgress", progress({ reviewed: 3 }))).toBe("Review suggestions, 3 of 8, 2 to verify");
    expect(chipLabel("inProgress", progress({ reviewed: 3, verify: 0 }))).toBe("Review suggestions, 3 of 8");
    expect(chipLabel("done", progress({ reviewed: 8 }))).toBe("All 8 suggestions reviewed");
  });

  it("shows the label, X of N and an amber 'to verify' while there is work, never a warning triangle", () => {
    const { container } = render(<ReviewChip state="inProgress" progress={progress({ reviewed: 3 })} isOpen={false} onClick={() => {}} />);
    const chip = screen.getByRole("button");
    expect(chip).toHaveTextContent("Review suggestions");
    expect(chip).toHaveTextContent("3 of 8");
    expect(chip).toHaveTextContent("2 to verify");
    expect(chip.className).toMatch(/attention/);
    expect(chip.className).not.toMatch(/critical/);
    expect(container.querySelector("svg circle")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("Review suggestions, 3 of 8, 2 to verify");
  });

  it("turns green with a check when everything is reviewed, and an icon sits beside the words in every state", () => {
    for (const state of ["idle", "checking", "clear", "notStarted", "inProgress", "done"] as const) {
      const { container, unmount } = render(<ReviewChip state={state} progress={progress({ reviewed: state === "done" ? 8 : 0 })} isOpen={false} onClick={() => {}} />);
      expect(container.querySelector("button svg, button [aria-hidden='true']")).not.toBeNull();
      if (state === "done") {
        expect(screen.getByRole("button")).toHaveTextContent("All 8 suggestions reviewed");
        expect(screen.getByRole("button").className).toMatch(/success/);
      }
      unmount();
    }
  });

  it("opens the panel on click and is at least 44px tall", () => {
    const onClick = vi.fn();
    render(<ReviewChip state="notStarted" progress={progress()} isOpen={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("button").className).toContain("min-h-[44px]");
  });
});

const card = () => document.querySelector<HTMLElement>('li[aria-current="true"]')!;
const tabs = () => screen.getByRole("group", { name: "Suggestion type" });
const liveRegion = () => document.querySelector('#review-panel [role="status"]')!;
const items = sampleItems();
const rewriteOne = items[0];

describe("ReviewPanel", () => {
  it("has one source of counts: header, progress, tabs and the bulk row agree", () => {
    render(<ReviewPanelDemo isPaidPlan />);
    const panel = screen.getByRole("dialog", { name: "Review suggestions" });
    expect(within(panel).getByText("Nothing changes on your resume until you accept.")).toBeInTheDocument();
    expect(within(panel).getByText("0 of 8 reviewed")).toBeInTheDocument();
    expect(within(panel).getByText("2 to verify")).toBeInTheDocument();
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveTextContent("5");
    expect(within(tabs()).getByRole("button", { name: /Fixes/ })).toHaveTextContent("3");
    expect(within(panel).getByText("3 rewrites keep all your facts unchanged.")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Accept 3" })).toBeInTheDocument();
    expect(within(panel).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(within(panel).getByRole("progressbar")).toHaveAttribute("aria-valuemax", "8");
    expect(screen.getByRole("button", { name: /Review suggestions/ })).toHaveTextContent("0 of 8");
  });

  it("opens the first card showing the FULL suggested and original text, with changes marked", () => {
    render(<ReviewPanelDemo />);
    const open = card();
    expect(within(open).getByText("Experience · Analytics Engineer")).toBeInTheDocument();
    expect(within(open).getByText("1 of 5")).toBeInTheDocument();
    expect(within(open).getByText(/Facts unchanged\. Same numbers and tools as your profile\./)).toBeInTheDocument();
    const suggested = within(open).getByText("Suggested").nextElementSibling!;
    const original = within(open).getByText("Your original").nextElementSibling!;
    expect(suggested.textContent).toBe(rewriteOne.after);
    expect(original.textContent).toBe(rewriteOne.before);
    expect(suggested.textContent).not.toContain("…");
    expect(suggested.querySelector("ins")?.textContent).toBe("Built");
    expect(original.querySelector("del")?.textContent).toBe("Made");
  });

  it("gives one primary action per view, with Decide later instead of Ignore", () => {
    render(<ReviewPanelDemo />);
    const open = card();
    expect(within(open).getByRole("button", { name: "Accept" }).className).toMatch(/bg-accent/);
    expect(within(open).getByRole("button", { name: "Keep original" })).toBeInTheDocument();
    expect(within(open).getByRole("button", { name: "Edit wording" })).toBeInTheDocument();
    expect(within(open).getByRole("button", { name: "Decide later" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ignore|Looks good|Use my original/ })).toBeNull();
  });

  it("flags a card that adds something new with an amber trust line and a Verify pill", () => {
    render(<ReviewPanelDemo />);
    const verifyRow = screen.getAllByRole("button", { expanded: false }).find((b) => b.textContent?.includes("Cut report time by 40%"))!;
    expect(verifyRow).toHaveTextContent("Verify");
    fireEvent.click(verifyRow);
    const open = card();
    const trust = within(open).getByText("New detail: '40%' is not in your profile. Confirm it or edit it out.");
    expect(trust.closest("p")!.className).toMatch(/attention/);
    expect(within(open).getByText("Suggested").nextElementSibling!.querySelector("ins")).toHaveTextContent("by 40%");
    expect(within(open).getAllByRole("button").every((b) => (b.className.includes("min-h-[44px]")))).toBe(true);
  });

  it("Accept opens the next card, leaves an Undo row and announces the progress", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" }));
    expect(liveRegion()).toHaveTextContent("Accepted. 1 of 8 reviewed.");
    expect(screen.getByText("1 of 8 reviewed")).toBeInTheDocument();
    expect(within(card()).getByText("2 of 5")).toBeInTheDocument();
    expect(document.querySelectorAll('li[aria-current="true"]')).toHaveLength(1);
    expect(screen.getByText(/^Accepted · Analytics Engineer$/)).toBeInTheDocument();
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveTextContent("4");
    expect(card()).toHaveFocus();
  });

  it("Keep original puts the candidate's wording back, and Undo re-opens the card", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Keep original" }));
    expect(screen.getByText(/^Kept original · Analytics Engineer$/)).toBeInTheDocument();
    expect(screen.getByText(rewriteOne.before)).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("Kept original. 1 of 8 reviewed.");

    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(liveRegion()).toHaveTextContent("Undone. 0 of 8 reviewed.");
    expect(screen.queryByText(/^Kept original/)).toBeNull();
    expect(within(card()).getByText("Suggested").nextElementSibling!.textContent).toBe(rewriteOne.after);
    expect(within(card()).getByText("1 of 5")).toBeInTheDocument();
  });

  it("applies and undoes a fix on the block text, and says Apply fix / Dismiss", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(tabs()).getByRole("button", { name: /Fixes/ }));
    const open = card();
    expect(within(open).getByText("Summary")).toBeInTheDocument();
    expect(within(open).getByText("Possible spelling mistake: 'recieved'").closest("p")!.className).toMatch(/info/);
    expect(within(open).getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
    expect(within(open).getByText("Your original").nextElementSibling!.textContent).toBe(SAMPLE_TEXTS.summary);
    expect(within(open).getByText("Suggested").nextElementSibling!.textContent).toBe(SAMPLE_TEXTS.summary.replace("recieved", "received"));

    fireEvent.click(within(open).getByRole("button", { name: "Apply fix" }));
    expect(screen.getByText(SAMPLE_TEXTS.summary.replace("recieved", "received"))).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(within(card()).getByText("Your original").nextElementSibling!.textContent).toBe(SAMPLE_TEXTS.summary);
  });

  it("Decide later skips the card, marks it Skipped and brings it back last", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Decide later" }));
    expect(liveRegion()).toHaveTextContent("Skipped for later. 0 of 8 reviewed.");
    expect(within(card()).getByText("2 of 5")).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll("#review-panel ul > li")).map((li) => li.textContent ?? "");
    expect(rows[0]).toContain("Suggested");
    expect(rows[rows.length - 1]).toContain("Skipped");

    // Everything else in Rewrites and Fixes is decided first; the skipped card comes back at the end.
    for (let i = 0; i < 7; i++) fireEvent.click(within(card()).getByRole("button", { name: /^(Accept|Apply fix)$/ }));
    expect(card().textContent).toContain(rewriteOne.after.split(" ")[1]);
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveTextContent("1");
  });

  it("edits inline with a labelled textarea, and saves the person's own wording", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Edit wording" }));
    const box = screen.getByLabelText("Edit wording") as HTMLTextAreaElement;
    expect(box).toHaveValue(rewriteOne.after);
    expect(box).toHaveFocus();
    fireEvent.change(box, { target: { value: "Built weekly Tableau dashboards for sales." } });
    fireEvent.click(screen.getByRole("button", { name: "Save and accept" }));
    expect(screen.getByText("Built weekly Tableau dashboards for sales.")).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("Saved and accepted. 1 of 8 reviewed.");
    // Undo puts the AI wording back.
    fireEvent.click(screen.getByRole("button", { name: /^Undo/ }));
    expect(within(card()).getByText("Your original")).toBeInTheDocument();
  });

  it("Cancel and Escape in the textarea close the editor, not the panel, and an empty edit cannot be saved", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Edit wording" }));
    const box = screen.getByLabelText("Edit wording");
    fireEvent.change(box, { target: { value: "  " } });
    expect(screen.getByRole("button", { name: "Save and accept" })).toBeDisabled();
    fireEvent.keyDown(box, { key: "Escape" });
    expect(screen.queryByLabelText("Edit wording")).toBeNull();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(within(card()).getByRole("button", { name: "Edit wording" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Edit wording")).toBeNull();
    expect(screen.getByText("0 of 8 reviewed")).toBeInTheDocument();
  });

  it("shortcuts A, K, E and S act on the open card, and are ignored while typing", () => {
    render(<ReviewPanelDemo />);
    const panel = screen.getByRole("dialog");
    fireEvent.keyDown(panel, { key: "a" });
    expect(screen.getByText("1 of 8 reviewed")).toBeInTheDocument();
    fireEvent.keyDown(panel, { key: "k" });
    expect(screen.getByText("2 of 8 reviewed")).toBeInTheDocument();
    fireEvent.keyDown(panel, { key: "s" });
    expect(screen.getAllByText("Skipped")).toHaveLength(1);
    fireEvent.keyDown(panel, { key: "e" });
    const box = screen.getByLabelText("Edit wording");
    fireEvent.keyDown(box, { key: "a" });
    expect(screen.getByText("2 of 8 reviewed")).toBeInTheDocument();
  });

  it("a free user sees the bulk action with a PRO badge that leads to upgrade, and it is never a silent accept", () => {
    render(<ReviewPanelDemo />);
    const link = screen.getByRole("link", { name: /Accept 3/ });
    expect(link).toHaveAttribute("href", "/upgrade");
    expect(link).toHaveTextContent("PRO");
    expect(screen.getByText("0 of 8 reviewed")).toBeInTheDocument();
  });

  it("Accept 3 takes only the rewrites that added no facts, each with its own Undo, never a flagged one", () => {
    render(<ReviewPanelDemo isPaidPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Accept 3" }));
    expect(screen.getByText("3 of 8 reviewed")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Undo/ })).toHaveLength(3);
    expect(within(screen.getByRole("dialog")).getByText("2 to verify")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Accept \d/ })).toBeNull();
    expect(within(card()).getByText(/New detail/)).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("Accepted 3. 3 of 8 reviewed.");
  });

  it("finishes with an All caught up card, a summary, a green bar and a way back to the resume", () => {
    render(<ReviewPanelDemo isPaidPlan />);
    fireEvent.click(screen.getByRole("button", { name: "Accept 3" }));
    fireEvent.click(within(card()).getByRole("button", { name: "Keep original" }));
    // The last rewrite is accepted; the tab is then finished and the panel jumps to Fixes.
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" }));
    expect(within(tabs()).getByRole("button", { name: /Fixes/ })).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 3; i++) fireEvent.click(within(card()).getByRole("button", { name: "Apply fix" }));

    const done = screen.getByRole("region", { name: "All caught up" });
    expect(done).toHaveTextContent("7 accepted, 1 kept as original");
    expect(screen.getByText("8 of 8 reviewed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar").firstElementChild!.className).toMatch(/success/);
    expect(screen.queryByText(/to verify/)).toBeNull();
    expect(screen.getByRole("button", { name: /All 8 suggestions reviewed/ })).toBeInTheDocument();
    fireEvent.click(within(done).getByRole("button", { name: "Back to my resume" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps header, progress and tabs outside the scrolling body, and never lets a card shrink", () => {
    render(<ReviewPanelDemo />);
    const body = document.querySelector("#review-panel > div.overflow-y-auto")!;
    expect(body).not.toBeNull();
    expect(body.contains(screen.getByRole("progressbar"))).toBe(false);
    expect(body.contains(tabs())).toBe(false);
    expect(body.contains(screen.getByRole("heading", { name: "Review suggestions" }))).toBe(false);
    for (const li of document.querySelectorAll("#review-panel ul > li")) expect(li.className).toContain("shrink-0");
  });

  it("uses real buttons with aria-pressed tabs and a labelled close button", () => {
    render(<ReviewPanelDemo />);
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(tabs()).getByRole("button", { name: /Fixes/ })).toHaveAttribute("aria-pressed", "false");
    const close = screen.getByRole("button", { name: "Close review panel" });
    expect(close.className).toContain("h-11");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
