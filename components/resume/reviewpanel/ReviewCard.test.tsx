// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
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
