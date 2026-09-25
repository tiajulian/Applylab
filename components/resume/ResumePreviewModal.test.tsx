// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResumePreviewModal } from "./ResumePreviewModal";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import { PAGE_HEIGHT } from "./ResumePreviewPane";
import type { ResumeContent } from "@/types";

afterEach(cleanup);

const resume: ResumeContent = {
  contact: { name: "Jamie Lee", phone: "0400 000 000", email: "jamie@example.com", location: "Sydney", linkedin: "", work_rights: "" },
  target_titles: [],
  summary: "Summary.",
  skills: [],
  tools: [],
  experience: [],
  projects: [],
  education: [],
  referees: [],
};

function renderModal(onClose = vi.fn()) {
  render(
    <ResumePreviewModal resume={resume} templateDef={getTemplateDefinition("clean")} density={DEFAULT_DENSITY} onClose={onClose} />
  );
  return onClose;
}

// jsdom never performs real layout, so scrollHeight is always 0 by default - stubbing it lets the
// pagination math (scrollHeight / PAGE_HEIGHT) be tested without a real browser, the same
// limitation and technique this session already used for canvas text measurement elsewhere.
function stubScrollHeight(px: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: px });
}

describe("ResumePreviewModal", () => {
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 0 });
  });

  it("renders as a dialog and shows exactly one page for content under one page tall", () => {
    stubScrollHeight(PAGE_HEIGHT - 50);
    renderModal();
    expect(screen.getByRole("dialog", { name: "Resume preview" })).toBeInTheDocument();
    // One visible page frame, plus the off-screen measuring copy - both render the resume once,
    // so two occurrences of the name is correct for a single page.
    expect(screen.getAllByText("Jamie Lee")).toHaveLength(2);
  });

  it("shows two page frames side by side for content just over one page tall", () => {
    stubScrollHeight(PAGE_HEIGHT + 50);
    renderModal();
    // Two visible pages + the measuring copy = 3 occurrences of the name.
    expect(screen.getAllByText("Jamie Lee")).toHaveLength(3);
  });

  it("closes on Escape", () => {
    const onClose = renderModal();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on a click on the dimmed backdrop", () => {
    const onClose = renderModal();
    fireEvent.mouseDown(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalled();
  });

  it("does not close on a click inside the visible page area itself", () => {
    const onClose = renderModal();
    // The off-screen measuring copy (not inside the stopPropagation wrapper, since it's invisible
    // and unclickable in practice) renders first in DOM order - the LAST occurrence is the real,
    // visible page.
    const occurrences = screen.getAllByText("Jamie Lee");
    fireEvent.mouseDown(occurrences[occurrences.length - 1]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("the close button closes the modal", () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalled();
  });
});
