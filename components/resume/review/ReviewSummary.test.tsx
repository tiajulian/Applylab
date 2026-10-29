// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { ResumeReviewCategory } from "@/types";
import { ReviewSummary } from "./ReviewSummary";

vi.mock("@/components/ui/Reveal", () => ({ Reveal: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/ui/CountUp", () => ({ CountUp: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock("@/components/ui/ProgressBar", () => ({ ProgressBar: ({ value }: { value: number }) => <div role="progressbar" aria-valuenow={value} /> }));
afterEach(cleanup);
const categories: ResumeReviewCategory[] = [
  { key: "ats_structure", label: "Structure", score: 20, max_points: 20, finding_count: 0, locked: false, assessment: "basic" },
  { key: "content_quality", label: "Content", score: 24, max_points: 30, finding_count: 1, locked: false, assessment: "ai" },
  { key: "writing_quality", label: "Writing", score: 16, max_points: 20, finding_count: 0, locked: false, assessment: "ai" },
  { key: "application_readiness", label: "Readiness", score: 15, max_points: 15, finding_count: 0, locked: false, assessment: "basic" },
  { key: "job_optimization", label: "Match", score: 12, max_points: 15, finding_count: 1, locked: false, assessment: "ai" },
];

describe("separate quality and match", () => {
  it("shows quality independently and leaves job match unassessed without an ad", () => {
    render(<ReviewSummary score={88} categories={categories} openCount={2} />);
    expect(screen.getByText("88")).toBeVisible();
    expect(screen.getByText("Not assessed")).toBeVisible();
    expect(screen.queryByText("80/100")).not.toBeInTheDocument();
  });
  it("shows job match only after an actual comparison", () => {
    render(<ReviewSummary score={88} categories={categories} openCount={2} hasJobAd />);
    expect(screen.getByText("80/100")).toBeVisible();
  });
  it("distinguishes an assessed zero match from an unavailable match", () => {
    render(<ReviewSummary score={88} categories={categories.map((c) => c.key === "job_optimization" ? { ...c, score: 0 } : c)} openCount={2} hasJobAd />);
    expect(screen.getByText("0/100")).toBeVisible();
  });
  it("keeps quality available when only the job comparison failed", () => {
    render(<ReviewSummary score={88} categories={categories.map((c) => c.key === "job_optimization" ? { ...c, assessment: "not_assessed", score: 0 } : c)} openCount={2} hasJobAd />);
    expect(screen.getByText("88")).toBeVisible();
    expect(screen.getByText("Not assessed")).toBeVisible();
    expect(screen.getByText(/couldn't finish the job comparison/)).toBeVisible();
  });
  it("labels basic checks without displaying a full quality or match score", () => {
    render(<ReviewSummary score={88} categories={categories.map((c) => ({ ...c, assessment: c.key === "job_optimization" ? "not_assessed" : "basic" }))} openCount={2} hasJobAd />);
    expect(screen.getByText("Basic checks completed")).toBeVisible();
    expect(screen.queryByText("88")).not.toBeInTheDocument();
    expect(screen.queryByText("80/100")).not.toBeInTheDocument();
    expect(screen.getByText(/full analysis could not finish/)).toBeVisible();
  });
  it("does not present a stale or legacy score as a current assessment", () => {
    render(<ReviewSummary score={88} categories={categories} openCount={2} hasJobAd isStale />);
    expect(screen.queryByText("88")).not.toBeInTheDocument();
    expect(screen.queryByText("80/100")).not.toBeInTheDocument();
    expect(screen.getByText("Check again for an updated review")).toBeVisible();
  });
});
