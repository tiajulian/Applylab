// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("opens the panel on click and is the same 32px height as the other toolbar buttons", () => {
    const onClick = vi.fn();
    render(<ReviewChip state="notStarted" progress={progress()} isOpen={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalled();
    expect(screen.getByRole("button").className).toContain("h-8");
  });
});

const card = () => document.querySelector<HTMLElement>('li[aria-current="true"]')!;
const tabs = () => screen.getByRole("group", { name: "Suggestion type" });
const list = () => document.querySelector<HTMLElement>("#review-panel ul")!;
const rowUndo = () => within(list()).getByRole("button", { name: /^Undo/ });
const toastUndo = () => screen.getByRole("dialog").querySelector<HTMLButtonElement>(":scope > div.absolute button")!;
const liveRegion = () => document.querySelector('#review-panel [role="status"]')!;
const items = sampleItems();
// rewrites 1-3 are reworded-only (see isRewordedInfo) - never a card, folded into the "matches your
// profile" line instead. verify4/5 are the only individually-actionable items in the Rewrites tab.
const verifyFour = items[3];

describe("ReviewPanel", () => {
  it("has one source of counts: header, progress and tabs agree; reworded-only rewrites are one calm line, not cards", () => {
    render(<ReviewPanelDemo />);
    const panel = screen.getByRole("dialog", { name: "Review suggestions" });
    expect(within(panel).getByText("Nothing changes on your resume until you accept.")).toBeInTheDocument();
    expect(within(panel).getByText("0 of 5 reviewed")).toBeInTheDocument();
    expect(within(panel).getByText("2 to verify")).toBeInTheDocument();
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveTextContent("2");
    expect(within(tabs()).getByRole("button", { name: /Fixes/ })).toHaveTextContent("3");
    expect(within(panel).getByText("3 more bullets already match your profile.")).toBeInTheDocument();
    expect(within(panel).queryByRole("button", { name: /Accept \d/ })).toBeNull();
    expect(within(panel).queryByRole("link", { name: /Accept \d/ })).toBeNull();
    expect(within(panel).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
    expect(within(panel).getByRole("progressbar")).toHaveAttribute("aria-valuemax", "5");
    expect(screen.getByRole("button", { name: /Review suggestions/ })).toHaveTextContent("0 of 5");
  });

  it("opens the first actionable card (a reworded-only rewrite is skipped) showing the FULL suggested and original text, with changes marked", () => {
    render(<ReviewPanelDemo />);
    const open = card();
    expect(within(open).getByText("Experience · Analytics Engineer")).toBeInTheDocument();
    expect(within(open).getByText("1 of 2")).toBeInTheDocument();
    expect(within(open).getByText(/New detail: '40%' is not in your profile/)).toBeInTheDocument();
    const suggested = within(open).getByText("Suggested").nextElementSibling!;
    const original = within(open).getByText("Your original").nextElementSibling!;
    expect(suggested.textContent).toBe(verifyFour.after);
    expect(original.textContent).toBe(verifyFour.before);
    expect(suggested.textContent).not.toContain("…");
    expect(suggested.querySelector("ins")).toHaveTextContent("by 40%");
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

  it("flags a card that adds something new with an amber trust line, and shows a Verify pill on a collapsed one", () => {
    render(<ReviewPanelDemo />);
    const open = card();
    const trust = within(open).getByText("New detail: '40%' is not in your profile. Confirm it or edit it out.");
    expect(trust.closest("p")!.className).toMatch(/attention/);
    expect(within(open).getAllByRole("button").every((b) => (b.className.includes("min-h-[var(--rp-target)]")))).toBe(true);

    const collapsedVerifyRow = screen.getAllByRole("button", { expanded: false }).find((b) => b.textContent?.includes("Led a team of 6"))!;
    expect(collapsedVerifyRow).toHaveTextContent("Verify");
  });

  it("Accept opens the next card, leaves an Undo row and announces the progress", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" }));
    expect(liveRegion()).toHaveTextContent("Accepted. 1 of 5 reviewed.");
    expect(screen.getByText("1 of 5 reviewed")).toBeInTheDocument();
    expect(within(card()).getByText("2 of 2")).toBeInTheDocument();
    expect(document.querySelectorAll('li[aria-current="true"]')).toHaveLength(1);
    expect(screen.getByText(/^Accepted · Analytics Engineer$/)).toBeInTheDocument();
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveTextContent("1");
    expect(card()).toHaveFocus();
  });

  it("Keep original puts the candidate's wording back, and Undo re-opens the card", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Keep original" }));
    expect(screen.getByText(/^Kept original · Analytics Engineer$/)).toBeInTheDocument();
    expect(screen.getByText(verifyFour.before)).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("Kept original. 1 of 5 reviewed.");

    fireEvent.click(rowUndo());
    expect(liveRegion()).toHaveTextContent("Undone. 0 of 5 reviewed.");
    expect(screen.queryByText(/^Kept original/)).toBeNull();
    expect(within(card()).getByText("Suggested").nextElementSibling!.textContent).toBe(verifyFour.after);
    expect(within(card()).getByText("1 of 2")).toBeInTheDocument();
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
    fireEvent.click(rowUndo());
    expect(within(card()).getByText("Your original").nextElementSibling!.textContent).toBe(SAMPLE_TEXTS.summary);
  });

  it("Decide later skips the card, marks it Skipped and brings it back last", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Decide later" }));
    expect(liveRegion()).toHaveTextContent("Skipped for later. 0 of 5 reviewed.");
    expect(within(card()).getByText("2 of 2")).toBeInTheDocument();
    const rows = Array.from(document.querySelectorAll("#review-panel ul > li")).map((li) => li.textContent ?? "");
    expect(rows[0]).toContain("Suggested");
    expect(rows[rows.length - 1]).toContain("Skipped");

    // Everything else in Rewrites (1 more) and Fixes (3) is decided first; the skipped card comes back last.
    for (let i = 0; i < 4; i++) fireEvent.click(within(card()).getByRole("button", { name: /^(Accept|Apply fix)$/ }));
    expect(card().textContent).toContain("40%");
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveTextContent("1");
  });

  it("edits inline with a labelled textarea, and saves the person's own wording", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Edit wording" }));
    const box = screen.getByLabelText("Edit wording") as HTMLTextAreaElement;
    expect(box).toHaveValue(verifyFour.after);
    expect(box).toHaveFocus();
    fireEvent.change(box, { target: { value: "Cut report time significantly using dbt." } });
    fireEvent.click(screen.getByRole("button", { name: "Save and accept" }));
    expect(screen.getByText("Cut report time significantly using dbt.")).toBeInTheDocument();
    expect(liveRegion()).toHaveTextContent("Saved and accepted. 1 of 5 reviewed.");
    // Undo puts the AI wording back.
    fireEvent.click(rowUndo());
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
    expect(screen.getByText("0 of 5 reviewed")).toBeInTheDocument();
  });

  it("shortcuts A, K, E and S act on the open card, and are ignored while typing", () => {
    render(<ReviewPanelDemo />);
    const panel = screen.getByRole("dialog");
    fireEvent.keyDown(panel, { key: "a" });
    expect(screen.getByText("1 of 5 reviewed")).toBeInTheDocument();
    fireEvent.keyDown(panel, { key: "k" });
    expect(screen.getByText("2 of 5 reviewed")).toBeInTheDocument();
    fireEvent.keyDown(panel, { key: "s" });
    expect(screen.getAllByText("Skipped")).toHaveLength(1);
    fireEvent.keyDown(panel, { key: "e" });
    const box = screen.getByLabelText("Edit wording");
    fireEvent.keyDown(box, { key: "a" });
    expect(screen.getByText("2 of 5 reviewed")).toBeInTheDocument();
  });

  it("finishes with an All caught up card, a summary, a green bar and a way back to the resume", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Keep original" })); // verify4
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" })); // verify5 - Rewrites tab now finished, jumps to Fixes
    expect(within(tabs()).getByRole("button", { name: /Fixes/ })).toHaveAttribute("aria-pressed", "true");
    for (let i = 0; i < 3; i++) fireEvent.click(within(card()).getByRole("button", { name: "Apply fix" }));

    const done = screen.getByRole("region", { name: "All caught up" });
    expect(done).toHaveTextContent("4 accepted, 1 kept as original");
    expect(screen.getByText("5 of 5 reviewed")).toBeInTheDocument();
    expect(screen.getByRole("progressbar").firstElementChild!.className).toMatch(/success/);
    expect(screen.queryByText(/to verify/)).toBeNull();
    expect(screen.getByRole("button", { name: /All 5 suggestions reviewed/ })).toBeInTheDocument();
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
    expect(close.className).toContain("h-[var(--rp-target)]");
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers a toast Undo after a decision, and it survives the panel moving to the other tab", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Keep original" })); // verify4
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" })); // verify5 - Rewrites tab now finished, jumps to Fixes
    // Rewrites are finished, so the panel jumped to Fixes and the row the toast points to is out of sight.
    expect(within(tabs()).getByRole("button", { name: /Fixes/ })).toHaveAttribute("aria-pressed", "true");
    expect(toastUndo()).not.toBeNull();
    fireEvent.click(toastUndo());
    expect(within(tabs()).getByRole("button", { name: /Rewrites/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("1 of 5 reviewed")).toBeInTheDocument();
    expect(toastUndo()).toBeNull();
  });

  it("removes the toast after a few seconds", () => {
    vi.useFakeTimers();
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" }));
    expect(toastUndo()).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(8100);
    });
    expect(toastUndo()).toBeNull();
    vi.useRealTimers();
  });

  it("re-opens the same card after Undo, with no stale re-open lock blocking the next one", () => {
    render(<ReviewPanelDemo />);
    fireEvent.click(within(card()).getByRole("button", { name: "Keep original" })); // verify4
    fireEvent.click(rowUndo());
    expect(within(card()).getByText("1 of 2")).toBeInTheDocument();
    fireEvent.click(within(card()).getByRole("button", { name: "Accept" })); // verify4 again
    expect(within(card()).getByText("2 of 2")).toBeInTheDocument(); // verify5 opened next, not stuck
  });

  it("is tight on a desktop and keeps 44px touch targets on a phone", () => {
    const target = () => screen.getByRole("dialog").style.getPropertyValue("--rp-target");
    const desktop = render(<ReviewPanelDemo />);
    expect(target()).toBe("28px");
    expect(screen.getByRole("dialog").style.getPropertyValue("--rp-text")).toBe("11px");
    desktop.unmount();

    vi.stubGlobal("matchMedia", vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })));
    render(<ReviewPanelDemo />);
    expect(target()).toBe("44px");
  });

  it("has no size switch", () => {
    render(<ReviewPanelDemo />);
    expect(screen.queryByRole("group", { name: "Panel size" })).toBeNull();
  });
});
