// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { chipLabel, chipState, ReviewChip } from "./ReviewChip";
import { ReviewPanel, type ReviewPanelProps } from "./ReviewPanel";
import type { ReviewItem } from "@/lib/review/types";

afterEach(cleanup);
// jsdom has no scrollIntoView.
window.HTMLElement.prototype.scrollIntoView = vi.fn();

let n = 0;
const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: `i${n++}`, resumeId: "r1", kind: "fix", ruleId: "spelling", severity: "warn", blockId: "summary", start: 3, end: 11,
  before: "recieved", after: "received", reason: "Possible spelling mistake: 'recieved'", status: "open", ...over,
});

describe("chip states", () => {
  it.each([
    ["idle", 0, 0, "Review"],
    ["checking", 0, 0, "Checking..."],
    ["ready", 0, 0, "All clear"],
    ["ready", 3, 0, "3 to review"],
    ["ready", 3, 1, "3 to review, 1 to verify"],
  ] as const)("%s (%i passages, %i verify) reads %s", (phase, count, verify, label) => {
    expect(chipLabel(chipState(phase, count, verify), count, verify)).toBe(label);
  });

  it("puts the label in a live region and an icon beside it in every state", () => {
    for (const state of ["idle", "checking", "clear", "review", "verify"] as const) {
      const { container, unmount } = render(<ReviewChip state={state} label={`label-${state}`} isOpen={false} onClick={() => {}} />);
      expect(screen.getByRole("status")).toHaveTextContent(`label-${state}`);
      expect(screen.getByRole("button")).toHaveTextContent(`label-${state}`);
      expect(container.querySelector("button svg, button [aria-hidden='true']")).not.toBeNull();
      unmount();
    }
  });

  it("opens the panel on click", () => {
    const onClick = vi.fn();
    render(<ReviewChip state="review" label="1 to review" isOpen={false} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button", { name: "1 to review" }));
    expect(onClick).toHaveBeenCalled();
  });
});

describe("ReviewPanel", () => {
  const base = (items: ReviewItem[], over: Partial<ReviewPanelProps> = {}): ReviewPanelProps => ({
    items, tab: "fix", onTabChange: vi.fn(), selectedId: items[0]?.id ?? null, isMobile: false, isPaidPlan: false,
    labels: new Map([["summary", "Summary"]]), texts: new Map([["summary", "We recieved the data."]]),
    canAccept: () => true, canRevert: () => false, hasEvidenceFlow: () => false,
    onSelect: vi.fn(), onAccept: vi.fn(), onEdit: vi.fn(), onDismiss: vi.fn(), onRestore: vi.fn(), onRevert: vi.fn(),
    onOpenEvidence: vi.fn(), onBulkApply: vi.fn(), onBulkClicked: vi.fn(), onUpgradeClick: vi.fn(), onClose: vi.fn(), ...over,
  });

  it("shows a free user the mistake, where it is and why, with a working Fix", () => {
    const props = base([item()]);
    render(<ReviewPanel {...props} />);
    expect(screen.getByText("Fix - Summary")).toBeInTheDocument();
    expect(screen.getByText(/Possible spelling mistake/)).toBeInTheDocument();
    expect(screen.getAllByText("recieved").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Upgrade to See Mistakes/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    expect(props.onAccept).toHaveBeenCalled();
  });

  it("gates only the bulk action: free sees a Pro link, paid gets the preview", () => {
    const free = render(<ReviewPanel {...base([item(), item({ blockId: "x" })])} />);
    expect(screen.getByRole("link", { name: /Fix all \(Pro\)/ })).toHaveAttribute("href", "/upgrade");
    free.unmount();

    const props = base([item(), item({ blockId: "x", before: "teh", after: "the" })], { isPaidPlan: true });
    render(<ReviewPanel {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Fix all" }));
    expect(props.onBulkClicked).toHaveBeenCalledWith("fix", 2);
    const preview = screen.getByRole("group", { name: /Fix all preview/ });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.click(within(preview).getAllByRole("button", { name: "Skip" })[0]);
    fireEvent.click(within(preview).getByRole("button", { name: "Apply 1" }));
    expect(props.onBulkApply).toHaveBeenCalledWith("fix", [expect.objectContaining({ before: "teh" })]);
  });

  it("Accept all on Changes lists reworded items and never a new claim", () => {
    const reworded = item({ kind: "change", provenance: "reworded", ruleId: "provenance.reworded", severity: "info", reason: "Reworded from your profile" });
    const claim = item({ kind: "change", provenance: "new_claim", ruleId: "provenance.new_claim", severity: "verify", reason: "Not in your profile: 65%", blockId: "y" });
    render(<ReviewPanel {...base([reworded, claim], { tab: "change", isPaidPlan: true })} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept all" }));
    const preview = screen.getByRole("group", { name: /Accept all preview/ });
    expect(within(preview).getAllByRole("listitem")).toHaveLength(1);
    expect(within(preview).queryByText(/65%/)).toBeNull();
    expect(screen.getByText("New claim: verify")).toBeInTheDocument();
  });

  it("counts open items per tab and lists dismissed items with a Restore", () => {
    const props = base([item(), item({ kind: "change", provenance: "reworded" }), item({ status: "dismissed" })]);
    render(<ReviewPanel {...props} />);
    expect(screen.getByRole("tab", { name: /Changes \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Fixes \(1\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismissed (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(props.onRestore).toHaveBeenCalled();
  });

  it("says all clear with nothing open, and caps the list with a show more control", () => {
    const empty = render(<ReviewPanel {...base([])} />);
    expect(screen.getByText(/All clear/)).toBeInTheDocument();
    empty.unmount();

    const many = Array.from({ length: 205 }, (_, i) => item({ blockId: `b${i}`, ruleId: "integrity.x", after: "" }));
    render(<ReviewPanel {...base(many)} />);
    expect(document.querySelectorAll("[data-review-card]")).toHaveLength(200);
    fireEvent.click(screen.getByRole("button", { name: /Show more \(5 more\)/ }));
    expect(document.querySelectorAll("[data-review-card]")).toHaveLength(205);
  });

  it("moves focus into the panel, and J/K/D/E/Enter/Escape work", () => {
    const [a, b] = [item(), item({ blockId: "z" })];
    const props = base([a, b]);
    render(<ReviewPanel {...props} />);
    const panel = screen.getByRole("dialog", { name: "Review" });
    expect(panel).toHaveFocus();

    fireEvent.keyDown(panel, { key: "j" });
    expect(props.onSelect).toHaveBeenLastCalledWith(b.id);
    fireEvent.keyDown(panel, { key: "e" });
    expect(props.onEdit).toHaveBeenCalledWith(a);
    fireEvent.keyDown(panel, { key: "d" });
    expect(props.onDismiss).toHaveBeenCalledWith(a);

    const card = document.querySelector(`[data-review-card="${a.id}"]`) as HTMLElement;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(props.onAccept).toHaveBeenCalledWith(a);

    fireEvent.keyDown(panel, { key: "Escape" });
    expect(props.onClose).toHaveBeenCalled();
  });

  it("does not steal keys typed into a text field", () => {
    const props = base([item()]);
    render(
      <>
        <ReviewPanel {...props} />
      </>
    );
    const panel = screen.getByRole("dialog");
    const input = document.createElement("input");
    panel.appendChild(input);
    fireEvent.keyDown(input, { key: "d" });
    expect(props.onDismiss).not.toHaveBeenCalled();
  });
});
