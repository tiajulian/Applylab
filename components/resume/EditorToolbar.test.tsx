// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
    isScoreStale: false,
    missingKeywords: [] as string[],
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
    const labelled = ["Review suggestions", "ATS 78/100", "Reorder sections", "Change template", "Design & Font", "History"];
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
  ])("keeps the ATS score's own colour for %i (the shared button colours must not override it)", (score, tone) => {
    setup({ atsScore: score });
    const button = screen.getByRole("button", { name: new RegExp(`ATS ${score}`) });
    expect(button.className).toMatch(tone);
    expect(button.className).not.toContain("bg-paper/50");
  });

  it("has no separate Score button: there is one ATS control", () => {
    setup();
    expect(screen.queryByRole("button", { name: /Score resume/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /ATS/ })).toHaveLength(1);
  });

  describe("before there is a score", () => {
    it("is the button that runs the score, and says Pro on the free plan", () => {
      const props = setup({ atsScore: null });
      const button = screen.getByRole("button", { name: "ATS score" });
      expect(button.className).toContain("bg-paper/50");
      fireEvent.click(button);
      expect(props.onScoreResume).toHaveBeenCalledTimes(1);
      cleanup();
      setup({ atsScore: null, isPaidPlan: false });
      expect(screen.getByRole("button", { name: "ATS score (Pro)" })).toBeInTheDocument();
    });

    it("shows Scoring… and cannot be pressed twice while it runs", () => {
      setup({ atsScore: null, isScoring: true });
      expect(screen.getByRole("button", { name: "Scoring…" })).toBeDisabled();
    });
  });

  describe("once scored", () => {
    it("opens the details instead of running the score again", () => {
      const props = setup();
      const button = screen.getByRole("button", { name: /ATS 78/ });
      expect(button).toHaveAttribute("aria-expanded", "false");
      fireEvent.click(button);
      expect(props.onScoreResume).not.toHaveBeenCalled();
      expect(button).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("dialog", { name: "ATS evaluation" })).toBeInTheDocument();
    });

    it("lists the missing keywords, or says they are all present", () => {
      setup({ missingKeywords: ["Snowflake", "dbt"] });
      fireEvent.click(screen.getByRole("button", { name: /ATS 78/ }));
      const dialog = screen.getByRole("dialog", { name: "ATS evaluation" });
      expect(within(dialog).getByText("Snowflake")).toBeInTheDocument();
      expect(within(dialog).getByText("dbt")).toBeInTheDocument();
      cleanup();
      setup({ missingKeywords: [] });
      fireEvent.click(screen.getByRole("button", { name: /ATS 78/ }));
      expect(screen.getByText(/All key job keywords are present/)).toBeInTheDocument();
    });

    it("re-scores from inside the details", () => {
      const props = setup();
      fireEvent.click(screen.getByRole("button", { name: /ATS 78/ }));
      fireEvent.click(within(screen.getByRole("dialog", { name: "ATS evaluation" })).getByRole("button", { name: "Re-score" }));
      expect(props.onScoreResume).toHaveBeenCalledTimes(1);
    });

    it("flags an outdated score with a dot and a note, never silently", () => {
      setup({ isScoreStale: true });
      expect(screen.getByRole("img", { name: /Outdated/ })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /ATS 78/ }));
      expect(screen.getByText(/resume has changed since this was scored/)).toBeInTheDocument();
    });

    it("shows no outdated flag for a current score", () => {
      setup({ isScoreStale: false });
      expect(screen.queryByRole("img", { name: /Outdated/ })).toBeNull();
    });

    it("closes on Escape, on the close button and on a click outside", async () => {
      setup();
      const open = () => fireEvent.click(screen.getByRole("button", { name: /ATS 78/ }));
      const gone = () => waitFor(() => expect(screen.queryByRole("dialog", { name: "ATS evaluation" })).toBeNull());
      open();
      fireEvent.keyDown(document, { key: "Escape" });
      await gone();
      open();
      fireEvent.click(screen.getByRole("button", { name: "Close" }));
      await gone();
      open();
      fireEvent.mouseDown(document.body);
      await gone();
    });

    it("shows Scoring… while a re-score runs and blocks a second press", () => {
      setup({ isScoring: true });
      fireEvent.click(screen.getByRole("button", { name: "Scoring…" }));
      expect(within(screen.getByRole("dialog", { name: "ATS evaluation" })).getByRole("button", { name: "Scoring…" })).toBeDisabled();
    });
  });

  it("wires the Review chip and History to their handlers", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: /Review suggestions/ }));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(props.onToggleReview).toHaveBeenCalled();
    expect(props.onOpenVersionHistory).toHaveBeenCalled();
  });

  it("disables Undo and Redo when there is nothing to undo or redo", () => {
    setup({ canUndo: false, canRedo: true });
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Redo" })).toBeEnabled();
  });
});
