// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { EditorToolbar } from "./EditorToolbar";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { DEFAULT_RESUME_SECTION_ORDER } from "@/lib/resume/resumeSections";

afterEach(cleanup);

const noop = () => {};

function setup(over: Partial<Parameters<typeof EditorToolbar>[0]> = {}) {
  const props = {
    chipRef: null,
    chipState: "inProgress" as const,
    chipProgress: { total: 24, reviewed: 1, accepted: 1, kept: 0, verify: 3 },
    isReviewOpen: false,
    onToggleReview: vi.fn(),
    atsScore: 78,
    isPaidPlan: true,
    isScoring: false,
    onScoreResume: vi.fn(),
    canUndo: false,
    canRedo: false,
    onUndo: noop,
    onRedo: noop,
    sectionOrder: [...DEFAULT_RESUME_SECTION_ORDER],
    onSetSectionOrder: noop,
    templateDef: getTemplateDefinition("clean"),
    onOpenTemplateModal: vi.fn(),
    isModernTemplate: false,
    accentColor: null,
    onSelectAccentColor: noop,
    onOpenVersionHistory: vi.fn(),
    totalPages: 2,
    onFitToOnePage: noop,
    fontSizePt: 10 as const,
    onSelectFontSize: noop,
    ...over,
  };
  render(<EditorToolbar {...props} />);
  return props;
}

const toolbar = () => screen.getByRole("toolbar", { name: "Resume editor toolbar" });

describe("EditorToolbar", () => {
  it("gives every labelled button an icon and the same 32px height, the Review chip included", () => {
    setup();
    const labelled = ["Review suggestions", "Score 78/100", "Reorder sections", "Change template", "Design & Font", "History"];
    for (const name of labelled) {
      const button = within(toolbar()).getByRole("button", { name: new RegExp(name.replace("/", "\\/")) });
      expect(button.querySelector("svg"), name).not.toBeNull();
      expect(button.className, name).toContain("h-8");
    }
  });

  it("names the template button 'Template' and keeps the current template in its tooltip", () => {
    const props = setup();
    const button = screen.getByRole("button", { name: "Change template" });
    expect(button).toHaveTextContent("Template");
    expect(button).toHaveAttribute("title", expect.stringContaining(props.templateDef.name));
    fireEvent.click(button);
    expect(props.onOpenTemplateModal).toHaveBeenCalled();
  });

  it("has no disabled placeholder button", () => {
    setup();
    expect(screen.queryByRole("button", { name: /Clean/ })).toBeNull();
  });

  it.each([
    [85, /success/],
    [65, /attention/],
    [30, /critical/],
  ])("keeps the score's own colour for %i (the shared button colours must not override it)", (score, tone) => {
    setup({ atsScore: score });
    const button = screen.getByRole("button", { name: new RegExp(`Score ${score}`) });
    expect(button.className).toMatch(tone);
    expect(button.className).not.toContain("bg-paper/50");
  });

  it("shows the neutral look before there is a score", () => {
    setup({ atsScore: null });
    expect(screen.getByRole("button", { name: /Score resume/ }).className).toContain("bg-paper/50");
  });

  it("wires the Review chip, Score and History to their handlers", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Review suggestions/ }));
    fireEvent.click(screen.getByRole("button", { name: /Score 78/ }));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(props.onToggleReview).toHaveBeenCalled();
    expect(props.onScoreResume).toHaveBeenCalled();
    expect(props.onOpenVersionHistory).toHaveBeenCalled();
  });

  it("disables Undo and Redo when there is nothing to undo or redo", () => {
    setup({ canUndo: false, canRedo: true });
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
  });
});
