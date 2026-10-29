// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReviewHighlights } from "./ReviewHighlights";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

afterEach(cleanup);
const content: ResumeContent = {
  contact: { name: "Sam Lee", email: "sam@example.com", phone: "0400000000", location: "", linkedin: "", work_rights: "" },
  target_titles: [], summary: "", skills: [], tools: [], projects: [], experience: [], education: [], referees: [],
};
const finding: ResumeReviewFinding = { id: "detail-1", title: "Explain who used this report", category_key: "content_quality", severity: "warning", status: "open" };

it("opens the chosen existing suggestion rather than creating another editing flow", () => {
  const onSelect = vi.fn();
  render(<ReviewHighlights content={content} findings={[finding]} unlocked onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: finding.title }));
  expect(onSelect).toHaveBeenCalledWith("detail-1");
  expect(screen.getByText("Your name, email and phone number are included.")).toBeVisible();
});

it("does not offer an action that cannot be opened on a locked review", () => {
  render(<ReviewHighlights content={content} findings={[finding]} unlocked={false} onSelect={vi.fn()} />);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText(finding.title)).toBeVisible();
});
