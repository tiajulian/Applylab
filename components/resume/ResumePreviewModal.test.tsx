// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ResumePreviewModal } from "./ResumePreviewModal";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_DENSITY } from "@/lib/resume/templateDensity";
import { A4_HEIGHT_PX, A4_WIDTH_PX, marginMmToPx } from "@/lib/pdf/pageGeometry";
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

function renderModal(onClose = vi.fn(), marginMm?: number, resumeContent: ResumeContent = resume) {
  render(
    <ResumePreviewModal
      resume={resumeContent}
      templateDef={getTemplateDefinition("clean")}
      density={DEFAULT_DENSITY}
      marginMm={marginMm}
      onClose={onClose}
    />
  );
  return onClose;
}

/** Only the VISIBLE page frames carry this test id - the off-screen trim-ladder measurers (one
 * per ladder state, always present) don't, so this is a reliable way to find "the pages actually
 * shown" regardless of how many measurers exist behind them. A data-testid rather than a class
 * selector deliberately: a pure visual-styling change (e.g. rounded-sm -> rounded-2xl, exactly
 * what broke this the first time) should never break these tests. */
function visibleFrames(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-testid="preview-page"]'));
}

/** The padding div sits directly around the visible page's own content, inside the transform-
 * scaled wrapper - this is the exact element the reported "no margin/text cut off at the edges"
 * bug is about, so tests target it directly rather than inferring padding from a bounding rect. */
function pagePaddingDiv(): HTMLElement {
  return visibleFrames()[0].querySelector('[style*="padding"]') as HTMLElement;
}

// jsdom never performs real layout, so scrollHeight is always 0 by default - stubbing it lets the
// pagination math (scrollHeight / A4_HEIGHT_PX) be tested without a real browser, the same
// limitation and technique this session already used for canvas text measurement elsewhere. A
// fixed value makes every trim-ladder state (each rendered in its own off-screen measurer) report
// the same height, which is enough for most tests; the trim-ladder describe block below instead
// derives height from each measurer's own rendered text length, so a state that actually trims
// content measures smaller, the same way real content genuinely takes less vertical space.
function stubScrollHeight(px: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: px });
}

/** React renders a numeric `padding` style as a single "Npx" value applied to all sides - matches
 * marginMmToPx's equal-on-every-side result, unlike the old asymmetric canvas padding. */
function paddingPx(marginMm: number): string {
  return `${marginMmToPx(marginMm)}px`;
}

function stubScrollHeightByTextLength(pxPerChar: number) {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return (this.textContent ?? "").length * pxPerChar;
    },
  });
}

describe("ResumePreviewModal", () => {
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 0 });
  });

  it("renders as a dialog and shows exactly one visible page for content under one page tall", () => {
    stubScrollHeight(A4_HEIGHT_PX - 50);
    renderModal();
    expect(screen.getByRole("dialog", { name: "Resume preview" })).toBeInTheDocument();
    expect(visibleFrames()).toHaveLength(1);
  });

  it("shows two page frames side by side for content just over one page tall", () => {
    stubScrollHeight(A4_HEIGHT_PX + 50);
    renderModal();
    expect(visibleFrames()).toHaveLength(2);
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
    fireEvent.mouseDown(visibleFrames()[0]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("the close button closes the modal", () => {
    const onClose = renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));
    expect(onClose).toHaveBeenCalled();
  });

  describe("page margin/padding (regression: reported with a screenshot as text touching/clipping past the page edges, no visible corner)", () => {
    it("with no marginMm passed, applies the standard margin - not zero padding", () => {
      stubScrollHeight(A4_HEIGHT_PX - 50);
      renderModal();
      expect(pagePaddingDiv().style.padding).toBe(paddingPx(13));
    });

    it("a custom marginMm converts to px the exact same way the real PDF's @page margin does", () => {
      stubScrollHeight(A4_HEIGHT_PX - 50);
      renderModal(vi.fn(), 16);
      expect(pagePaddingDiv().style.padding).toBe(paddingPx(16));
      // Confirms it actually moved from the standard default, not coincidentally identical.
      expect(pagePaddingDiv().style.padding).not.toBe(paddingPx(13));
    });
  });

  describe("regression: a narrow viewport used to clip a 2-page spread instead of shrinking it to fit", () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    });

    it("scales two pages down enough that, together with the gap between them, they fit within the viewport width", () => {
      // At the default 768px test viewport height, width only binds the scale (rather than
      // height) below ~1067px wide - 1000 sits just under that, at a scale (~0.558) still safely
      // above MIN_SIDE_BY_SIDE_SCALE so this exercises the width-fit path, not the stacked one.
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
      stubScrollHeight(A4_HEIGHT_PX + 50);
      renderModal();
      const frames = visibleFrames();
      expect(frames).toHaveLength(2);
      const totalWidth = frames.reduce((sum, f) => sum + parseFloat(f.style.width), 0) + 24; // + the gap between them
      // Real browser layout would also apply the container's own max-w-[95vw] cap - this asserts
      // the JS-computed scale itself already lands comfortably under the viewport width, with the
      // safety margin (MAX_WIDTH_VW < the CSS cap) that fixes the clipping bug, not just under the
      // raw viewport width by coincidence.
      expect(totalWidth).toBeLessThan(1000 * 0.95);
    });

    it("at a wide, tall viewport, does not shrink pages down needlessly (bounded by MAX_SCALE, not width or height)", () => {
      const originalInnerHeight = window.innerHeight;
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 3000 });
      Object.defineProperty(window, "innerHeight", { configurable: true, value: 3000 });
      stubScrollHeight(A4_HEIGHT_PX - 50);
      renderModal();
      const frame = visibleFrames()[0];
      // MAX_SCALE (1.35) * A4_WIDTH_PX - plenty of room at this viewport size, so neither width
      // nor height should be the binding constraint here.
      expect(parseFloat(frame.style.width)).toBeCloseTo(A4_WIDTH_PX * 1.35, 0);
      Object.defineProperty(window, "innerHeight", { configurable: true, value: originalInnerHeight });
    });
  });

  describe("stacked fallback: a viewport too narrow for a readable side-by-side spread stacks pages vertically instead", () => {
    const originalInnerWidth = window.innerWidth;

    afterEach(() => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: originalInnerWidth });
    });

    it("at a narrow viewport, stacks two pages vertically (same left edge, page 2 below page 1) at a readable size, rather than shrinking both to fit side by side", () => {
      // At the default 768px test viewport height, 865px wide pushes the side-by-side scale
      // (~0.48) below MIN_SIDE_BY_SIDE_SCALE (0.55), triggering the stacked fallback.
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 865 });
      stubScrollHeight(A4_HEIGHT_PX + 50);
      renderModal();
      const frames = visibleFrames();
      expect(frames).toHaveLength(2);
      // Stacked, not side by side: both pages take the full available width (bounded only by
      // A4_WIDTH_PX/height, not divided between them) - meaningfully wider than the side-by-side
      // case's ~half-width pages would be at this same viewport.
      const width = parseFloat(frames[0].style.width);
      expect(width).toBeGreaterThan(A4_WIDTH_PX * 0.55);
      // The container itself switches to a vertical (column) layout.
      const container = frames[0].parentElement!;
      expect(container.className).toContain("flex-col");
      expect(container.className).not.toContain("flex-row");
    });

    it("still lays two pages out side by side once the viewport is wide enough for a readable spread", () => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: 1400 });
      stubScrollHeight(A4_HEIGHT_PX + 50);
      renderModal();
      const container = visibleFrames()[0].parentElement!;
      expect(container.className).toContain("flex-row");
      expect(container.className).not.toContain("flex-col");
    });
  });

  describe("trim ladder integration (regression: the preview showed the full, untrimmed resume regardless of whether the real PDF export would need to trim it to fit)", () => {
    afterEach(() => {
      Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, value: 0 });
    });

    // A projects section large enough that including it clearly exceeds one page (under the
    // text-length-based stub below), and dropping it (the trim ladder's very first step) clearly
    // fits back under one page - a real, measurable difference, not a coincidence of the stub.
    const resumeWithBigProjects: ResumeContent = {
      ...resume,
      projects: [
        {
          title: "Big Project",
          context: "Personal",
          year: "2023",
          bullets: Array.from(
            { length: 12 },
            (_, i) => `Project bullet number ${i} with a good amount of extra descriptive padding text to increase the measured character count for this test.`
          ),
        },
      ],
    };

    it("drops the projects section from the VISIBLE page when the full resume would need 2+ pages, matching the real PDF export's first trim step", () => {
      // ~1900 chars of project bullets alone, well past one page at 1px/char; the baseline
      // resume (no projects) is well under it. Off-screen measurers for the untrimmed state still
      // contain "Big Project" (that's the whole point - they're what gets measured to decide it
      // doesn't fit), so the assertion is scoped to the VISIBLE frame specifically, not the
      // whole document.
      stubScrollHeightByTextLength(1);
      renderModal(vi.fn(), undefined, resumeWithBigProjects);
      expect(visibleFrames()).toHaveLength(1);
      expect(within(visibleFrames()[0]).queryByText("Big Project")).not.toBeInTheDocument();
    });

    it("still shows the projects section when the whole resume already fits on one page", () => {
      stubScrollHeight(A4_HEIGHT_PX - 50);
      renderModal(vi.fn(), undefined, resumeWithBigProjects);
      expect(visibleFrames()).toHaveLength(1);
      expect(within(visibleFrames()[0]).getByText("Big Project")).toBeInTheDocument();
    });

    it("renders one off-screen measuring copy per trim-ladder state, none of them visible", () => {
      stubScrollHeight(A4_HEIGHT_PX - 50);
      renderModal(vi.fn(), undefined, resumeWithBigProjects);
      // At least the untrimmed state and the projects-dropped state - the ladder has more steps
      // than that (spacing, summary, font), all rendered off-screen regardless of which one wins.
      const allCopies = screen.getAllByText("Jamie Lee");
      expect(allCopies.length).toBeGreaterThan(visibleFrames().length);
    });
  });
});
