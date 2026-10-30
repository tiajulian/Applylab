// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviewCard } from "./ReviewCard";
import type { ReviewEntry } from "@/lib/review/progress";
import type { ReviewItem } from "@/lib/review/types";

afterEach(cleanup);

const noop = () => {};
const item = (over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: "i1", resumeId: "r1", kind: "change", ruleId: "provenance.new_claim", severity: "verify", blockId: "experienceBullet:0:0",
  start: 0, end: 0, before: "", after: "", reason: "Is this true?", status: "open", ...over,
});
const entry = (over: Partial<ReviewItem> = {}): ReviewEntry => ({ item: item(over), state: "pending" });

function renderCard(over: Partial<ReviewItem>) {
  return render(
    <ReviewCard
      entry={entry(over)}
      label="Experience, Analytics Engineer"
      blockText=""
      expanded
      editing={false}
      skipped={false}
      place={{ index: 1, count: 1 }}
      canAccept
      canKeep
      onExpand={noop}
      onAccept={noop}
      onKeep={noop}
      onSkip={noop}
      onStartEdit={noop}
      onCancelEdit={noop}
      onSaveEdit={noop}
      onUndo={noop}
    />
  );
}

describe("ReviewCard word diff (bold/italic markers, lib/resume/bulletMarkup.ts)", () => {
  it("shows no diff noise when the only difference between before/after is a bold/italic marker", () => {
    const { container } = renderCard({ before: "Led a team", after: "**Led** a team" });
    expect(container.querySelector("ins")).toBeNull();
    expect(container.querySelector("del")).toBeNull();
  });

  it("still highlights a genuine wording change alongside markers on both sides", () => {
    const { container } = renderCard({ before: "**Led** a team", after: "**Managed** a team" });
    expect(container.querySelector("ins")).toHaveTextContent("Managed");
    expect(container.querySelector("del")).toHaveTextContent("Led");
    // Markers themselves never show up as literal text in the rendered diff.
    expect(container.textContent).not.toContain("**");
  });
});

describe("guided cards", () => {
  function guided(ruleId: string, text: string, phrase = text, evidence = "") {
    const accept = vi.fn();
    const start = text.indexOf(phrase);
    const props = {
      entry: entry({ kind: "fix", ruleId, before: phrase, after: "", start, end: start + phrase.length }),
      label: "Experience", blockText: text, expanded: true, editing: false, skipped: false, place: null,
      canAccept: false, canKeep: true, roleEvidence: evidence,
      onExpand: noop, onAccept: accept, onKeep: noop, onSkip: noop, onStartEdit: noop,
      onCancelEdit: noop, onSaveEdit: noop, onUndo: noop,
    };
    return { ...render(<ReviewCard {...props} />), accept };
  }

  it("previews a grounded chip and passes the suggested item to the existing accept callback", () => {
    const { accept } = guided("style.jobAd", "Built technical solutions.", "technical solutions", "Built dashboards.");
    expect(screen.queryByText("Suggested")).toBeNull();
    expect(screen.getByRole("button", { name: "Apply fix" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "dashboards" }));
    expect(screen.getByRole("button", { name: "dashboards" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Suggested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({ before: "technical solutions", after: "dashboards", start: 6 }));
  });

  it.each([
    ["style.buzzword", "A team player", "team player"],
    ["style.passive", "Reports were improved by the team.", "were improved"],
  ])("shows a live preview for %s without applying blank custom wording", (rule, text, phrase) => {
    const { accept } = guided(rule, text, phrase);
    fireEvent.click(screen.getByRole("button", { name: "Something else" }));
    const input = screen.getByRole("textbox", { name: "Your wording" });
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Apply fix" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "specific wording" } });
    expect(screen.getByText("Suggested")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({ after: "specific wording" }));
    fireEvent.change(input, { target: { value: "   " } });
    expect(screen.queryByText("Suggested")).toBeNull();
    expect(screen.getByRole("button", { name: "Apply fix" })).toBeDisabled();
  });

  it("requires a typed number and never supplies one", () => {
    const { accept } = guided("integrity.no-metrics", "Built reports.");
    const input = screen.getByRole("textbox", { name: "Number and context" });
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: "Apply fix" })).toBeDisabled();
    fireEvent.change(input, { target: { value: "12 reports weekly" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply fix" }));
    expect(accept).toHaveBeenCalledWith(expect.objectContaining({ after: "Built reports. (12 reports weekly)" }));
  });
});

describe("pointing at the resume", () => {
  it("shows the rule's detail and a Show on resume link", () => {
    const onReveal = vi.fn();
    render(
      <ReviewCard entry={entry({ kind: "fix", ruleId: "integrity.chronology", severity: "warn", reason: "Roles aren't in reverse-chronological order",
        detail: "Data Analyst started after Clerk but is listed below it." })}
        label="Experience, Data Analyst" blockText="Dec 2024 - May 2026" expanded editing={false} skipped={false} place={null}
        canAccept canKeep onExpand={noop} onAccept={noop} onKeep={noop} onSkip={noop} onStartEdit={noop} onCancelEdit={noop}
        onSaveEdit={noop} onUndo={noop} onReveal={onReveal} />
    );
    expect(screen.getByText("Data Analyst started after Clerk but is listed below it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Move role up/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show on resume" }));
    expect(onReveal).toHaveBeenCalledOnce();
  });
});
