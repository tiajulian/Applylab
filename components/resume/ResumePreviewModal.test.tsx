// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ResumePreviewModal } from "./ResumePreviewModal";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import { PAGE_HEIGHT, SHEET_WIDTH } from "./ResumePreviewPane";
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

  describe("regression: a narrow viewport used to clip a 2-page spread instead of shrinking it to fit", () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    });

    it("scales two pages down enough that, together with the gap between them, they fit within the viewport width", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 700 });
      stubScrollHeight(PAGE_HEIGHT + 50);
      renderModal();
      const frames = screen.getAllByText("Jamie Lee").map((el) => el.closest(".shrink-0.overflow-hidden") as HTMLElement | null).filter(Boolean) as HTMLElement[];
      expect(frames).toHaveLength(2);
      const totalWidth = frames.reduce((sum, f) => sum + parseFloat(f.style.width), 0) + 24; // + the gap between them
      // Real browser layout would also apply the container's own max-w-[95vw] cap - this asserts
      // the JS-computed scale itself already lands comfortably under the viewport width, with the
      // safety margin (MAX_WIDTH_VW < the CSS cap) that fixes the clipping bug, not just under the
      // raw viewport width by coincidence.
      expect(totalWidth).toBeLessThan(700 * 0.95);
    });

    it("at a wide, tall viewport, does not shrink pages down needlessly (bounded by MAX_SCALE, not width or height)", () => {
      const originalInnerHeight = window.innerHeight;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 3000 });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 3000 });
      stubScrollHeight(PAGE_HEIGHT - 50);
      renderModal();
      const frame = screen.getAllByText("Jamie Lee")[1].closest(".shrink-0.overflow-hidden") as HTMLElement;
      // MAX_SCALE (1.35) * SHEET_WIDTH - plenty of room at this viewport size, so neither width
      // nor height should be the binding constraint here.
      expect(parseFloat(frame.style.width)).toBeCloseTo(SHEET_WIDTH * 1.35, 0);
      Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
    });
  });

  describe("stacked fallback: a viewport too narrow for a readable side-by-side spread stacks pages vertically instead", () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    });

    it("at a narrow viewport, stacks two pages vertically (same left edge, page 2 below page 1) at a readable size, rather than shrinking both to fit side by side", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 610 });
      stubScrollHeight(PAGE_HEIGHT + 50);
      renderModal();
      const frames = screen.getAllByText("Jamie Lee").map((el) => el.closest(".shrink-0.overflow-hidden") as HTMLElement).filter(Boolean);
      expect(frames).toHaveLength(2);
      // Stacked, not side by side: both pages take the full available width (bounded only by
      // SHEET_WIDTH/height, not divided between them) - meaningfully wider than the side-by-side
      // case's ~half-width pages would be at this same viewport.
      const width = parseFloat(frames[0].style.width);
      expect(width).toBeGreaterThan(SHEET_WIDTH * 0.55);
      // The container itself switches to a vertical (column) layout.
      const container = frames[0].parentElement!;
      expect(container.className).toContain("flex-col");
      expect(container.className).not.toContain("flex-row");
    });

    it("still lays two pages out side by side once the viewport is wide enough for a readable spread", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
      stubScrollHeight(PAGE_HEIGHT + 50);
      renderModal();
      const frames = screen.getAllByText("Jamie Lee").map((el) => el.closest(".shrink-0.overflow-hidden") as HTMLElement).filter(Boolean);
      const container = frames[0].parentElement!;
      expect(container.className).toContain("flex-row");
      expect(container.className).not.toContain("flex-col");
    });
  });
});
