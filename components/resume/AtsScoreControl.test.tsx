// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AtsScoreControl } from "./AtsScoreControl";
afterEach(cleanup);
const props = { atsScore: 0, isScoreStale: false, missingKeywords: [], isPaidPlan: true, isScoring: false, onScoreResume: vi.fn() };
describe("keyword comparison states", () => {
  it("does not crash or show an assessed score for malformed stored keyword details", () => {
    render(<AtsScoreControl {...props} missingKeywords={[null] as unknown as string[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Keyword match · Check again/ }));
    expect(screen.getByText(/saved result needs a new check/)).toBeInTheDocument();
  });
  it("does not reopen old details after a restored resume clears its score", () => {
    const view = render(<AtsScoreControl {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Keyword match 0/100" }));
    view.rerender(<AtsScoreControl {...props} atsScore={null} />);
    view.rerender(<AtsScoreControl {...props} atsScore={78} />);
    expect(screen.getByRole("button", { name: "Keyword match 78/100" })).toHaveAttribute("aria-expanded", "false");
  });
  it("never reports every keyword present for a zero with empty details", () => {
    render(<AtsScoreControl {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Keyword match 0/100" }));
    expect(screen.getByText(/does not mean every job requirement is met/)).toBeInTheDocument();
    expect(screen.queryByText(/Great job|All key job/)).not.toBeInTheDocument();
  });
  it("shows no match score or retry action without an ad", () => {
    render(<AtsScoreControl {...props} hasJobAd={false} />);
    fireEvent.click(screen.getByRole("button", { name: /Keyword match · Not assessed/ }));
    expect(screen.getByText(/No job ad is attached/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Re-score" })).not.toBeInTheDocument();
  });
  it("hides invalid or legacy score details until assessed again", () => {
    render(<AtsScoreControl {...props} isAssessmentValid={false} missingKeywords={["Old keyword"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Keyword match · Check again/ }));
    expect(screen.queryByText("Old keyword")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Re-score" })).toBeEnabled();
  });
  it("does not present old keywords as current after an edit", () => {
    render(<AtsScoreControl {...props} isScoreStale missingKeywords={["Old keyword"]} />);
    fireEvent.click(screen.getByRole("button", { name: /Keyword match 0/ }));
    expect(screen.queryByText("Old keyword")).not.toBeInTheDocument();
    expect(screen.getByText(/resume or job ad has changed/)).toBeInTheDocument();
  });
});
