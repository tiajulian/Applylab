// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ResumeCard } from "./ResumeCard";
import type { DocumentListResume, ResumeReviewCategory, ResumeReviewCategoryKey } from "@/types";

afterEach(cleanup);
const keys: ResumeReviewCategoryKey[] = ["ats_structure", "content_quality", "writing_quality", "job_optimization", "application_readiness"];
const categories: ResumeReviewCategory[] = keys.map((key) => ({ key, label: key, score: 15, max_points: 20, finding_count: 0, locked: false, assessment: "basic" }));
const resume: DocumentListResume = { id: "res-1", job_title: "Analyst", company_name: null, created_at: "2026-10-29T00:00:00Z", ats_score: null, review_overall_score: 88, cover_letter_content: null, review_categories: categories };

it("does not present a basic-only result as a full resume score", () => {
  render(<ResumeCard resume={resume} />);
  expect(screen.getByText("Basic checks only")).toBeVisible();
  expect(screen.queryByText(/88\/100/)).not.toBeInTheDocument();
});

it("labels a complete review as resume quality", () => {
  render(<ResumeCard resume={{ ...resume, review_categories: categories.map((c) => c.key === "content_quality" || c.key === "writing_quality" ? { ...c, assessment: "ai" } : c) }} />);
  expect(screen.getByText("Resume quality 88/100")).toBeVisible();
  expect(screen.getByRole("link", { name: "Check & improve" })).toHaveAttribute("href", "/resume/res-1/review");
});
