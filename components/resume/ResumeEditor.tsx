"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { keywordContentKey } from "@/lib/resume/keywordScore";
import { ResumePreviewPane, type ResumePreviewPaneHandle } from "@/components/resume/ResumePreviewPane";
import { ResumePreviewModal } from "@/components/resume/ResumePreviewModal";
import { ActionRail } from "@/components/resume/ActionRail";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { ReviewHighlightContext } from "@/components/templates/shared";
import { ReviewPanel, type ReviewTab } from "@/components/resume/reviewpanel/ReviewPanel";
import { chipState } from "@/components/resume/reviewpanel/ReviewChip";
import { DEFAULT_RESUME_SECTION_ORDER, effectiveSectionOrder, sectionHasContent, type ReorderableResumeSection } from "@/lib/resume/resumeSections";
import { EditorToolbar } from "@/components/resume/EditorToolbar";
import { VersionHistorySlideOver } from "@/components/resume/VersionHistorySlideOver";
import { DesignPanel } from "@/components/resume/designpanel/DesignPanel";
import { useAutosave, type AutosaveStatus } from "@/lib/hooks/useAutosave";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useResumeHistory } from "@/lib/hooks/useResumeHistory";
import { useReviewEntries } from "@/lib/hooks/useReviewEntries";
import { useReviewItems } from "@/lib/hooks/useReviewItems";
import { applyFix, blockText, moveRoleIntoOrder, revertChange } from "@/lib/review/apply";
import { blockOrder, fieldKeysFor, listBlocks, setBlockText } from "@/lib/review/blocks";
import { buildPassages, isCounted } from "@/lib/review/engine";
import { nextToReview, reviewProgress, type ReviewEntry, type UndoEdit } from "@/lib/review/progress";
import type { ProfileSource } from "@/lib/review/provenance";
import { profileHasWord } from "@/lib/profile/replaceWord";
import type { ReviewItem, ReviewPassage } from "@/lib/review/types";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { canonicalTemplate } from "@/lib/resume/templateMetadata";
import { addCustomSection } from "@/lib/resume/resumeFieldUpdaters";
import { clampFontSizePt, DEFAULT_DENSITY, type FontSizePt } from "@/lib/resume/templateDensity";
import {
  fontChoiceById,
  lineHeightCeilingFor,
  marginMmFor,
  spacingStartScaleFor,
  type FontChoiceId,
  type LineHeightPreset,
  type MarginPreset,
  type SpacingPreset,
} from "@/lib/resume/designPrefs";
import { trackFunnelEvent } from "@/lib/analytics";
import type { ProfileLibrary } from "@/lib/resume/addEntries";
import { factCheckTargetKey } from "@/types";
import type {
  CanonicalTemplate,
  ContentScoreBreakdown,
  ContentScoreIssue,
  FactCheckFlag,
  Resume,
  ResumeContent,
  Template,
} from "@/types";

export function ResumeEditor({
  resumeId,
  initialResumeContent,
  profileLibrary,
  profile = null,
  initialTemplate,
  initialFontSizePt,
  initialAccentColor = null,
  initialFontChoice = null,
  initialMarginPreset = null,
  initialSpacingPreset = null,
  initialLineHeightPreset = null,
  isPaidPlan,
  initialFactCheckFlags,
  initialBridgeFactCheckFlags,
  skillsBridgeId,
  atsScore,
  atsScoredContentKey = null,
  hasKeywordJobAd = false,
  missingKeywords = [],
  contentScore,
  contentScoreBreakdown,
  contentScoreIssues,
  contentScoreCount,
  setContentScore,
  setContentScoreBreakdown,
  setContentScoreIssues,
  setContentScoreCount,
  setAtsScore,
  isScoring,
  onScoreResume,
  isUnlocked,
  downloadingFormat,
  onDownload,
  onDownloadLocked,
  onSaveStatusChange,
  onSaveErrorChange,
}: {
  resumeId: string;
  initialResumeContent: ResumeContent;
  /** The profile lists the canvas's Add pop-up offers under "From my profile". */
  profileLibrary?: ProfileLibrary;
  /** The Career Profile the review panel compares AI-tailored bullets against. */
  profile?: ProfileSource | null;
  initialTemplate: Template;
  initialFontSizePt: number;
  /** The Design & Font panel's per-resume overrides (lib/resume/designPrefs.ts) - all optional/
   * null-defaulted, so every existing caller (and the review test fixture) renders exactly as
   * before without needing to pass them. */
  initialAccentColor?: string | null;
  initialFontChoice?: FontChoiceId | null;
  initialMarginPreset?: MarginPreset | null;
  initialSpacingPreset?: SpacingPreset | null;
  initialLineHeightPreset?: LineHeightPreset | null;
  isPaidPlan: boolean;
  initialFactCheckFlags: FactCheckFlag[];
  initialBridgeFactCheckFlags: FactCheckFlag[];
  skillsBridgeId: string | null;
  atsScore?: number | null;
  atsScoredContentKey?: string | null;
  hasKeywordJobAd?: boolean;
  missingKeywords?: string[];
  contentScore: number | null;
  contentScoreBreakdown: ContentScoreBreakdown | null;
  contentScoreIssues: ContentScoreIssue[];
  contentScoreCount: number;
  setContentScore: Dispatch<SetStateAction<number | null>>;
  setContentScoreBreakdown: Dispatch<SetStateAction<ContentScoreBreakdown | null>>;
  setContentScoreIssues: Dispatch<SetStateAction<ContentScoreIssue[]>>;
  setContentScoreCount: Dispatch<SetStateAction<number>>;
  setAtsScore: Dispatch<SetStateAction<number | null>>;
  /** The AI score run is owned by ResumeWorkspace (it also drives the review-page flow), passed
   * through so EditorToolbar's Score badge can trigger the same call. */
  isScoring: boolean;
  onScoreResume: (content?: ResumeContent) => void;
  /** Passed straight through to ActionRail - the download flow (paid gate, export-review gate,
   * funnel tracking) all still lives in ResumeWorkspace. */
  isUnlocked: boolean;
  downloadingFormat: "pdf" | "docx" | null;
  onDownload: (format: "pdf" | "docx") => void;
  onDownloadLocked: () => void;
  /** Mirrors useAutosave's status/error up to ResumeWorkspace so EditorTopBar can show "Saved"
   * next to the document title - the save itself stays here, next to the live resume snapshot. */
  onSaveStatusChange?: (status: AutosaveStatus) => void;
  onSaveErrorChange?: (error: string | null) => void;
}) {
  const history = useResumeHistory({
    content: initialResumeContent,
    template: initialTemplate,
    accentColor: initialAccentColor,
    fontSizePt: clampFontSizePt(initialFontSizePt),
    fontChoice: initialFontChoice,
    marginPreset: initialMarginPreset,
    spacingPreset: initialSpacingPreset,
    lineHeightPreset: initialLineHeightPreset,
  });
  const { resume: snapshot, commit, dispatchTransient, onFieldBlur, canUndo, canRedo } = history;
  const { content: resume, template, accentColor, fontSizePt, fontChoice, marginPreset, spacingPreset, lineHeightPreset } = snapshot;

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const templateRequestId = useRef(0);
  const [fontSizeStatus, setFontSizeStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fontSizeRequestId = useRef(0);
  const accentColorRequestId = useRef(0);
  // One shared status/request-id pair for the Design & Font panel's three remaining presets
  // (font/margin/spacing/line-height) - they're never edited concurrently from two different
  // controls at once the way template/font-size each have their own toolbar control, so one
  // shared pair (rather than three more near-identical ones) is enough to guard against a stale
  // response clobbering a newer edit.
  const [designPrefStatus, setDesignPrefStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const designPrefRequestId = useRef(0);
  const [totalPages, setTotalPages] = useState(1);
  // Full-size, side-by-side-pages popup toggled from ActionRail's Preview button (see
  // ResumePreviewModal's own comment for why it's a separate view rather than switching the
  // editing canvas itself read-only in place, which is what this used to do).
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  // Mirrors ResumePreviewPane's zoom scale for display in ViewSettingsPopover - zoom itself stays
  // driven from there (CSS transform), this is display-only, same pattern as onPageCountChange.

  // Jumps the preview to the page containing a clicked section (see BaseResumeTemplate's
  // getZoneProps) - a convenience for multi-page resumes, independent of editing itself.
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Clear the selected section on any press outside a section zone (grey canvas area, toolbars,
  // sidebar...). pointerdown in the capture phase, not bubbling mousedown: it fires first and can't
  // be swallowed by another handler's stopPropagation/preventDefault (dnd-kit, popovers, etc.).
  // The selection's own floating toolbar (data-selection-keep) is exempt: it unmounts on deselect.
  useEffect(() => {
    if (!activeSection) return;
    const clearIfOutside = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.("[data-section], [data-selection-keep]")) setActiveSection(null);
    };
    document.addEventListener("pointerdown", clearIfOutside, true);
    return () => document.removeEventListener("pointerdown", clearIfOutside, true);
  }, [activeSection]);

  // Compare the exact server-assessed content, not a change in the numeric score.
  // A same-number re-score can be fresh, and edits during a request must remain stale.
  const currentKeywordContentKey = useMemo(() => keywordContentKey(resume), [resume]);
  const isScoreStale = atsScoredContentKey !== currentKeywordContentKey;

  const [flags, setFlags] = useState<FactCheckFlag[]>([...initialFactCheckFlags, ...initialBridgeFactCheckFlags]);
  const [openFix, setOpenFix] = useState<{ targetKey: string | null; flags: FactCheckFlag[]; anchorRect: DOMRect | null } | null>(
    null
  );
  const previewPaneRef = useRef<ResumePreviewPaneHandle>(null);
  // Marks the DOM region the keyboard-shortcut handler treats as "the resume canvas", to tell a
  // canvas field apart from an unrelated text input elsewhere on the page (see that effect below).
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  // One review list drives the chip, the panel and the preview highlights. Items whose block text has
  // changed since the last analysis are held back until it re-runs (their offsets would be stale), which
  // is also when the chip reads "Checking...".
  const review = useReviewItems({ resumeId, content: resume, profile, flags });
  const blocks = useMemo(() => listBlocks(resume), [resume]);
  const blockTexts = useMemo(() => new Map(blocks.map((b) => [b.id, b.text])), [blocks]);
  const blockLabels = useMemo(() => new Map(blocks.map((b) => [b.id, b.label])), [blocks]);
  const order = useMemo(() => blockOrder(blocks), [blocks]);
  const reviewItems = useMemo(() => {
    return review.items
      .filter((i) => review.analysed.get(i.blockId) === blockTexts.get(i.blockId))
      .sort((a, b) => (order.get(a.blockId) ?? 0) - (order.get(b.blockId) ?? 0) || a.start - b.start);
  }, [review.items, review.analysed, order, blockTexts]);
  const selectedItem = reviewItems.find((i) => i.id === review.selectedId) ?? null;
  // buildPassages only ambient-highlights warn/verify items (isCounted excludes "info" - most
  // rewrites are info-severity, see provenance.reworded) - deliberately, so routine rewrites don't
  // paint the whole resume. But the one card the panel has open still needs a visible answer to
  // "which part of my resume is this about", so it gets its own passage regardless of severity.
  const passages = useMemo(() => {
    const base = buildPassages(reviewItems);
    // selectedId isn't cleared once its card is decided and nothing else is left to advance to (see
    // ReviewPanel's advance()), so a just-accepted/dismissed item can still be "selected" here - only
    // an item still open (undecided) gets this synthetic highlight, or a stale one lingers forever.
    if (!selectedItem || selectedItem.status !== "open" || base.some((p) => p.itemIds.includes(selectedItem.id))) return base;
    return [...base, { blockId: selectedItem.blockId, start: selectedItem.start, end: selectedItem.end, severity: "selected" as const, itemIds: [selectedItem.id] }];
  }, [reviewItems, selectedItem]);
  const passagesByBlock = useMemo(() => {
    const map = new Map<string, ReviewPassage[]>();
    for (const passage of passages) {
      for (const key of fieldKeysFor(passage.blockId)) map.set(key, [...(map.get(key) ?? []), passage]);
    }
    return map;
  }, [passages]);
  // One list feeds the chip and the panel, so their counts cannot disagree.
  const { entries, record, forget } = useReviewEntries(reviewItems, order);
  const progress = useMemo(() => reviewProgress(entries), [entries]);
  const verifyCount = progress.verify;
  const chip = chipState(review.phase, progress);
  const previewHighlights = useMemo(
    () => Object.fromEntries(passages.map((p) => [p.blockId, selectedItem && p.itemIds.includes(selectedItem.id) ? "active" : "flagged"] as const)),
    [passages, selectedItem]
  );

  const isMobile = useIsMobile(768);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<ReviewTab>("fix");
  // Docked the same way the review panel is (see openPanel/closePanel below), mutually exclusive
  // with it - one docked side panel at a time, matching the plan's own note that this should be
  // confirmed once mocked up rather than treated as fixed; easy to relax later if it doesn't feel
  // right (drop the closePanel/setPanelOpen(false) calls on each side).
  const [designPanelOpen, setDesignPanelOpen] = useState(false);
  const [pendingDownload, setPendingDownload] = useState<"pdf" | "docx" | null>(null);

  const eventPayload = (item: ReviewItem) => ({ resumeId, ruleId: item.ruleId, kind: item.kind });

  function openPanel() {
    if (panelOpen) return;
    setDesignPanelOpen(false);
    // Use the actionable queue: reworded-only information has no card to open.
    const firstOpen = reviewItems.find((i) => i.status === "open" && i.severity === "verify") ?? nextToReview(entries, new Set(), panelTab);
    setPanelOpen(true);
    if (firstOpen) selectItem(firstOpen.id);
    trackFunnelEvent("panel_opened", { resumeId, openCount: passages.length, verifyCount });
  }

  function closePanel() {
    setPanelOpen(false);
    requestAnimationFrame(() => chipRef.current?.focus());
  }

  function toggleDesignPanel() {
    if (designPanelOpen) {
      setDesignPanelOpen(false);
      return;
    }
    if (panelOpen) closePanel();
    setDesignPanelOpen(true);
  }

  function fieldFor(blockId: string) {
    for (const key of fieldKeysFor(blockId)) {
      const el = canvasContainerRef.current?.querySelector<HTMLElement>(`[data-fc-target="${key}"]`);
      if (el) return el;
    }
    return null;
  }

  /** Scrolls the preview to the item's text and pulses it twice (skipped for reduced-motion users). */
  function revealItem(item: ReviewItem) {
    const el = fieldFor(item.blockId);
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    if (!calm && typeof el.animate === "function") {
      const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand-500").trim() || "215 98 37";
      el.animate(
        [{ boxShadow: `0 0 0 0 rgb(${brand} / 0.55)` }, { boxShadow: `0 0 0 6px rgb(${brand} / 0)` }],
        { duration: 900, easing: "ease-out", iterations: 2 }
      );
    }
  }

  function selectItem(id: string) {
    review.select(id);
    const item = reviewItems.find((i) => i.id === id);
    if (!item) return;
    setPanelTab(item.kind);
    revealItem(item);
  }

  // A click on a highlight (either the editable canvas or the read-only preview) opens the same card.
  function selectFromHighlight(id: string) {
    if (!panelOpen) {
      setPanelOpen(true);
      trackFunnelEvent("panel_opened", { resumeId, openCount: passages.length, verifyCount, source: "highlight" });
    }
    selectItem(id);
  }
  const handleHighlightActivate = (blockId: string) => {
    const item = reviewItems.find((i) => isCounted(i) && i.blockId === blockId);
    if (item) selectFromHighlight(item.id);
  };

  const [profileFix, setProfileFix] = useState<{
    from: string;
    to: string;
    status: "offered" | "saving" | "done" | "error";
  } | null>(null);

  async function applyFixToProfile() {
    if (!profileFix) return;
    setProfileFix({ ...profileFix, status: "saving" });
    try {
      const response = await fetch("/api/profile/fix-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: profileFix.from, to: profileFix.to }),
      });
      setProfileFix({ ...profileFix, status: response.ok ? "done" : "error" });
    } catch {
      setProfileFix({ ...profileFix, status: "error" });
    }
  }

  /** Writes one block's text as a single History step. False if the block is unknown or already reads that. */
  function writeBlock(blockId: string, text: string): boolean {
    const next = setBlockText(resume, blockId, text);
    if (next === resume || blockTexts.get(blockId) === text) return false;
    review.analyzeSoon();
    commit({ type: "REPLACE_CONTENT", content: next });
    return true;
  }

  function acceptItem(item: ReviewItem): boolean {
    let undo: UndoEdit | undefined;
    let decided = item;
    if (item.kind === "fix") {
      const move = moveRoleIntoOrder(resume, item);
      // A moved role's done row should name the role at its new place, not whichever role took its old one.
      if (move) decided = { ...item, blockId: `experienceHeader:${move.to}:dates` };
      const next = move?.content ?? applyFix(resume, item);
      if (!next) return false;
      undo = move
        ? { experience: { from: next.experience, to: resume.experience } }
        : { blockId: item.blockId, from: blockText(next, item.blockId) ?? "", to: blockTexts.get(item.blockId) ?? "" };
      review.analyzeSoon();
      commit({ type: "REPLACE_CONTENT", content: next });
      // A typo that came from the profile would come back in every new resume: offer to fix it there too.
      if (item.ruleId === "spelling" && item.after && profileHasWord(profile, item.before)) {
        setProfileFix({ from: item.before, to: item.after, status: "offered" });
      }
    }
    review.setStatus([item.id], "accepted");
    record(decided, "accepted", undo);
    trackFunnelEvent("item_accepted", eventPayload(item));
    return true;
  }

  /** Keep original: a rewrite goes back to the candidate's own wording; a fix is dismissed. */
  function keepItem(item: ReviewItem): boolean {
    if (item.kind === "fix") {
      review.setStatus([item.id], "dismissed");
      record(item, "kept");
      trackFunnelEvent("item_dismissed", eventPayload(item));
      return true;
    }
    const next = revertChange(resume, item);
    if (!next) return false;
    review.analyzeSoon();
    commit({ type: "REPLACE_CONTENT", content: next });
    review.setStatus([item.id], "resolved");
    record(item, "kept", { blockId: item.blockId, from: item.before, to: item.after });
    trackFunnelEvent("item_reverted", eventPayload(item));
    return true;
  }

  /** Save and accept: the person's own wording replaces the block. */
  function saveEdit(item: ReviewItem, text: string): boolean {
    if (!blocks.some((b) => b.id === item.blockId && b.writable)) return false;
    const before = blockTexts.get(item.blockId);
    if (before === undefined) return false;
    const changed = writeBlock(item.blockId, text);
    review.setStatus([item.id], "accepted");
    record(item, "accepted", changed ? { blockId: item.blockId, from: text, to: before } : undefined);
    trackFunnelEvent("item_edited", eventPayload(item));
    return true;
  }

  /** Undo re-opens a decided card, putting back any text the decision changed (if it still reads the same). */
  function undoEntry({ item, undo }: ReviewEntry): boolean {
    if (undo && "experience" in undo) {
      if (JSON.stringify(resume.experience) !== JSON.stringify(undo.experience.from)) return false;
      review.analyzeSoon();
      commit({ type: "REPLACE_CONTENT", content: { ...resume, experience: undo.experience.to } });
    } else if (undo) {
      const current = blockTexts.get(undo.blockId);
      if (current !== undo.from && current !== undo.to) return false;
      if (current === undo.from) writeBlock(undo.blockId, undo.to);
    } else if (!reviewItems.some((i) => i.id === item.id)) return false;
    review.setStatus([item.id], "open");
    forget(item.id);
    return true;
  }

  /** Composite headers are edited using their real canvas fields, not a whole-block text replacement. */
  function editSource(item: ReviewItem): boolean {
    if (blocks.some((b) => b.id === item.blockId && b.writable)) return false;
    if (isMobile) closePanel();
    requestAnimationFrame(() => {
      const field = fieldFor(item.blockId);
      field?.scrollIntoView({ block: "center" });
      field?.focus();
    });
    return true;
  }

  /** "Show on resume": on a phone the panel covers the page, so it closes first (the highlight stays tappable). */
  function showOnResume(item: ReviewItem) {
    if (!fieldFor(item.blockId)) return;
    if (isMobile) closePanel();
    requestAnimationFrame(() => revealItem(item));
  }

  function openEvidence(item: ReviewItem) {
    const matching = flags.filter((f) => f.target && factCheckTargetKey(f.target) === item.blockId);
    setOpenFix({ targetKey: item.blockId, flags: matching, anchorRect: fieldFor(item.blockId)?.getBoundingClientRect() ?? null });
  }

  // Undo/redo re-check straight away, so the chip and highlights follow the text instead of lagging 1.5s.
  const undo = useCallback(() => {
    review.analyzeSoon();
    history.undo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.undo, review.analyzeSoon]);
  const redo = useCallback(() => {
    review.analyzeSoon();
    history.redo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.redo, review.analyzeSoon]);

  // Nothing left to verify (fixed, reverted, dismissed): the prompt no longer applies.
  useEffect(() => {
    if (verifyCount === 0) setPendingDownload(null);
  }, [verifyCount]);

  // Downloads are never blocked: with unverified AI claims open, a small prompt offers Review or
  // download anyway.
  function handleDownload(format: "pdf" | "docx") {
    if (verifyCount > 0 && isUnlocked) {
      trackFunnelEvent("download_with_open_verify_items", { resumeId, count: verifyCount, format });
      setPendingDownload(format);
      return;
    }
    onDownload(format);
  }

  const { status, error, saveNow } = useAutosave(resume, async (value) => {
    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resume_content: value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to save resume");
    }
  });

  useEffect(() => {
    onSaveStatusChange?.(status);
    onSaveErrorChange?.(error);
    // Only re-run when the status/error this mirrors actually changes - onSaveStatusChange/
    // onSaveErrorChange are state setters passed straight through from ResumeWorkspace, stable
    // across renders, so omitting them here doesn't risk a stale closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, error]);

  // Keyboard shortcuts: undo/redo/save/zoom, wired straight to the same command layer and pane
  // handle the toolbar buttons already use. Always preventDefault() before acting - these fields
  // are native inputs/textareas, so the browser's own per-field undo buffer and Ctrl+S "Save Page
  // As" dialog would otherwise fire alongside (or instead of) the app-level action.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      // This listener is global (fires regardless of focus) so the shortcuts work from anywhere
      // on the page, but FactCheckFixPanel's "capture evidence" note is a real, separate text
      // field outside the canvas - without this check, fixing a typo there with Ctrl+Z would
      // silently undo the last RESUME edit instead of the note, since it's the browser's native
      // per-field undo that should apply there, not the app's command-stack undo. The mobile
      // bottom sheet's field is a real canvas field too, just portaled outside this container, so
      // it's allowed via its own marker rather than DOM containment.
      const activeEl = document.activeElement as HTMLElement | null;
      const isCanvasField =
        canvasContainerRef.current?.contains(activeEl) || activeEl?.dataset.canvasField === "true";
      const isForeignInput = (activeEl?.tagName === "TEXTAREA" || activeEl?.tagName === "INPUT") && !isCanvasField;
      // A pop-up over the canvas (e.g. Add role) owns the keyboard: undo/save/zoom would act on the
      // resume behind it, out of sight.
      if (isForeignInput || activeEl?.closest('[aria-modal="true"]')) return;

      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        previewPaneRef.current?.zoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        previewPaneRef.current?.zoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        previewPaneRef.current?.resetZoom();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, saveNow]);

  async function handleSelectTemplate(next: CanonicalTemplate, nextAccent?: string | null) {
    const previous = template;
    const previousAccent = accentColor;
    if (previous !== next) {
      trackFunnelEvent("template_switched", { resumeId, fromTemplate: previous, toTemplate: next });
    }
    const requestId = ++templateRequestId.current;
    commit({ type: "SET_TEMPLATE", template: next, accentColor: nextAccent });
    setTemplateStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: next }),
    });

    if (requestId !== templateRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_TEMPLATE", template: canonicalTemplate(previous), accentColor: previousAccent });
      setTemplateStatus("error");
      return;
    }

    setTemplateStatus("saved");
  }

  async function handleSelectAccentColor(next: string | null) {
    const previous = accentColor;
    const requestId = ++accentColorRequestId.current;
    commit({ type: "SET_ACCENT_COLOR", accentColor: next });
    setDesignPrefStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accent_color: next }),
    });

    if (requestId !== accentColorRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_ACCENT_COLOR", accentColor: previous });
      setDesignPrefStatus("error");
      return;
    }

    setDesignPrefStatus("saved");
  }

  async function handleSelectFontSize(next: FontSizePt) {
    const previous = fontSizePt;
    const requestId = ++fontSizeRequestId.current;
    commit({ type: "SET_FONT_SIZE", fontSizePt: next });
    setFontSizeStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ font_size_pt: next }),
    });

    if (requestId !== fontSizeRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_FONT_SIZE", fontSizePt: previous });
      setFontSizeStatus("error");
      return;
    }

    setFontSizeStatus("saved");
  }

  // The Design & Font panel's remaining three presets (accent color/font size above already had
  // their own dedicated toolbar controls before this panel existed, so they keep their own
  // status/request-id pairs) - all three follow the identical request-id-guarded PATCH + rollback
  // pattern handleSelectFontSize established, just parametrised over which field/body key/command.
  async function handleSelectFontChoice(next: FontChoiceId | null) {
    const previous = fontChoice;
    const requestId = ++designPrefRequestId.current;
    commit({ type: "SET_FONT_CHOICE", fontChoice: next });
    setDesignPrefStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ font_choice: next }),
    });

    if (requestId !== designPrefRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_FONT_CHOICE", fontChoice: previous });
      setDesignPrefStatus("error");
      return;
    }

    setDesignPrefStatus("saved");
  }

  async function handleSelectMarginPreset(next: MarginPreset | null) {
    const previous = marginPreset;
    const requestId = ++designPrefRequestId.current;
    commit({ type: "SET_MARGIN_PRESET", marginPreset: next });
    setDesignPrefStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ margin_preset: next }),
    });

    if (requestId !== designPrefRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_MARGIN_PRESET", marginPreset: previous });
      setDesignPrefStatus("error");
      return;
    }

    setDesignPrefStatus("saved");
  }

  async function handleSelectSpacingPreset(next: SpacingPreset | null) {
    const previous = spacingPreset;
    const requestId = ++designPrefRequestId.current;
    commit({ type: "SET_SPACING_PRESET", spacingPreset: next });
    setDesignPrefStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spacing_preset: next }),
    });

    if (requestId !== designPrefRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_SPACING_PRESET", spacingPreset: previous });
      setDesignPrefStatus("error");
      return;
    }

    setDesignPrefStatus("saved");
  }

  async function handleSelectLineHeightPreset(next: LineHeightPreset | null) {
    const previous = lineHeightPreset;
    const requestId = ++designPrefRequestId.current;
    commit({ type: "SET_LINE_HEIGHT_PRESET", lineHeightPreset: next });
    setDesignPrefStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line_height_preset: next }),
    });

    if (requestId !== designPrefRequestId.current) return;

    if (!response.ok) {
      commit({ type: "SET_LINE_HEIGHT_PRESET", lineHeightPreset: previous });
      setDesignPrefStatus("error");
      return;
    }

    setDesignPrefStatus("saved");
  }

  // Selecting the new section scrolls the canvas to it and shows its toolbar, like any other add.
  function handleAddSection() {
    commit({ type: "REPLACE_CONTENT", content: addCustomSection(resume) });
    setActiveSection(`custom-${(resume.custom_sections ?? []).length}`);
  }

  function handleSetSectionOrder(next: ReorderableResumeSection[]) {
    commit({ type: "REPLACE_CONTENT", content: { ...resume, section_order: next } });
  }

  function handleFixApplied(updatedResume: Resume) {
    if (updatedResume.resume_content) commit({ type: "REPLACE_CONTENT", content: updatedResume.resume_content });
    setFlags([...(updatedResume.fact_check_flags ?? []), ...(updatedResume.bridge_fact_check_flags ?? [])]);
    setOpenFix(null);
  }

  function handleCloseFix() {
    setOpenFix(null);
  }

  function handleVersionRestored(updatedResume: Resume) {
    if (updatedResume.resume_content) {
      commit({ type: "RESTORE_VERSION", content: updatedResume.resume_content });
    }
    setAtsScore(null);
    setContentScore(updatedResume.content_score);
  }

  // Combined for display only - EditorToolbar shows one "Saving.../Saved/Couldn't save" label for
  // all three status pairs above, the same way EditorTopBar shows one label for content autosave.
  const designSaveStatus: "idle" | "saving" | "saved" | "error" =
    [templateStatus, fontSizeStatus, designPrefStatus].includes("saving")
      ? "saving"
      : [templateStatus, fontSizeStatus, designPrefStatus].includes("error")
        ? "error"
        : [templateStatus, fontSizeStatus, designPrefStatus].includes("saved")
          ? "saved"
          : "idle";

  const currentTemplateDef = getTemplateDefinition(template);
  const reviewHighlightValue = useMemo(
    () => ({ passages: passagesByBlock, selectedItemId: review.selectedId, onSelectItem: selectFromHighlight }),
    // selectFromHighlight closes over the latest items/panel state; the value only needs to change with them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [passagesByBlock, review.selectedId, panelOpen, reviewItems]
  );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <EditorToolbar
        chipRef={chipRef}
        chipState={chip}
        chipProgress={progress}
        isReviewOpen={panelOpen}
        onToggleReview={() => (panelOpen ? closePanel() : openPanel())}
        atsScore={atsScore}
        isKeywordAssessmentValid={atsScoredContentKey !== null}
        hasKeywordJobAd={hasKeywordJobAd}
        isScoreStale={isScoreStale}
        missingKeywords={missingKeywords}
        isPaidPlan={isPaidPlan}
        isScoring={isScoring}
        onScoreResume={() => onScoreResume(resume)}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        sectionOrder={effectiveSectionOrder(resume.section_order, currentTemplateDef.tokens.sectionOrder === "skills_first")}
        visibleSections={DEFAULT_RESUME_SECTION_ORDER.filter((section) => sectionHasContent(resume, section))}
        onSetSectionOrder={handleSetSectionOrder}
        onAddSection={handleAddSection}
        templateDef={currentTemplateDef}
        onOpenTemplateModal={() => setShowTemplateModal(true)}
        isDesignOpen={designPanelOpen}
        onToggleDesign={toggleDesignPanel}
        onOpenVersionHistory={() => setShowVersionHistory(true)}
        designSaveStatus={designSaveStatus}
      />

      {profileFix && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink-secondary"
        >
          {profileFix.status === "done" ? (
            <span>Fixed in your profile too, so new resumes won&apos;t repeat it.</span>
          ) : profileFix.status === "error" ? (
            <span className="text-critical">Couldn&apos;t update your profile. Fix it on the Profile page instead.</span>
          ) : (
            <>
              <span>
                &ldquo;{profileFix.from}&rdquo; is also in your profile. Fix it there too, so new resumes don&apos;t repeat it?
              </span>
              <button
                type="button"
                onClick={applyFixToProfile}
                disabled={profileFix.status === "saving"}
                className="font-semibold text-accent hover:text-accent-hover disabled:opacity-60"
              >
                {profileFix.status === "saving" ? "Fixing…" : "Fix in profile"}
              </button>
            </>
          )}
          <button type="button" onClick={() => setProfileFix(null)} className="ml-auto text-xs text-ink-muted hover:text-ink">
            {profileFix.status === "offered" ? "No thanks" : "Close"}
          </button>
        </div>
      )}

      <div ref={canvasContainerRef} className="flex h-full min-h-0 flex-1 gap-1 overflow-hidden sm:gap-2">
        <div className="h-full min-w-0 flex-1">
          <ReviewHighlightContext.Provider value={reviewHighlightValue}>
          <ResumePreviewPane
            ref={previewPaneRef}
            resume={resume}
            templateDef={currentTemplateDef}
            fontSizePt={fontSizePt}
            density={{ ...DEFAULT_DENSITY, fontPt: fontSizePt, spacingScale: spacingStartScaleFor({ spacingPreset }) }}
            accentColor={accentColor}
            fontOverride={fontChoiceById(fontChoice)?.fontFamily}
            lineHeightCeiling={lineHeightCeilingFor({ lineHeightPreset })}
            marginMm={marginMmFor({ marginPreset })}
            highlights={previewHighlights}
            activeSection={activeSection}
            onSectionClick={setActiveSection}
            onHighlightActivate={handleHighlightActivate}
            onPageCountChange={setTotalPages}
            editable
            resumeId={resumeId}
            onFieldChange={(next) => dispatchTransient({ type: "REPLACE_CONTENT", content: next })}
            onFieldCommit={(next) => commit({ type: "REPLACE_CONTENT", content: next })}
            onFieldBlur={onFieldBlur}
            profileLibrary={profileLibrary}
          />
          </ReviewHighlightContext.Provider>
        </div>

        {panelOpen && (
          <ReviewPanel
            entries={entries}
            tab={panelTab}
            onTabChange={setPanelTab}
            selectedId={review.selectedId}
            isMobile={isMobile}
            labels={blockLabels}
            texts={blockTexts}
            content={resume}
            profile={profile}
            canAccept={(item) => item.kind === "change" || Boolean(item.after) || Boolean(moveRoleIntoOrder(resume, item))}
            canKeep={(item) => item.kind === "fix" || (Boolean(item.before) && blockTexts.get(item.blockId) === item.after)}
            hasEvidenceFlow={(item) => item.ruleId.startsWith("factcheck.")}
            onSelect={selectItem}
            onAccept={acceptItem}
            onKeep={keepItem}
            onSaveEdit={saveEdit}
            onUndo={undoEntry}
            onEditSource={editSource}
            onOpenEvidence={openEvidence}
            onReveal={showOnResume}
            onClose={closePanel}
          />
        )}

        {designPanelOpen && (
          <DesignPanel
            isMobile={isMobile}
            accentColor={accentColor}
            fontChoice={fontChoice}
            marginPreset={marginPreset}
            spacingPreset={spacingPreset}
            lineHeightPreset={lineHeightPreset}
            onSelectAccentColor={handleSelectAccentColor}
            onSelectFontChoice={handleSelectFontChoice}
            onSelectMarginPreset={handleSelectMarginPreset}
            onSelectSpacingPreset={handleSelectSpacingPreset}
            onSelectLineHeightPreset={handleSelectLineHeightPreset}
            fontSizePt={fontSizePt}
            onSelectFontSize={handleSelectFontSize}
            totalPages={totalPages}
            onClose={() => setDesignPanelOpen(false)}
          />
        )}

        <ActionRail
          onOpenPreview={() => setPreviewModalOpen(true)}
          isPaidPlan={isPaidPlan}
          isUnlocked={isUnlocked}
          downloadingFormat={downloadingFormat}
          onDownload={handleDownload}
          onDownloadLocked={onDownloadLocked}
        />
      </div>

      {previewModalOpen && (
        <ResumePreviewModal
          resume={resume}
          templateDef={currentTemplateDef}
          density={{ ...DEFAULT_DENSITY, fontPt: fontSizePt, spacingScale: spacingStartScaleFor({ spacingPreset }) }}
          accentColor={accentColor}
          fontOverride={fontChoiceById(fontChoice)?.fontFamily}
          lineHeightCeiling={lineHeightCeilingFor({ lineHeightPreset })}
          marginMm={marginMmFor({ marginPreset })}
          onClose={() => setPreviewModalOpen(false)}
        />
      )}

      <ChooseTemplateModal
        isOpen={showTemplateModal}
        selectedTemplate={template}
        selectedAccentColor={accentColor}
        onSelect={handleSelectTemplate}
        onClose={() => setShowTemplateModal(false)}
      />

      {openFix && (
        <FactCheckFixPanel
          flags={openFix.flags}
          anchorRect={openFix.anchorRect}
          resumeId={resumeId}
          resumeContent={resume}
          skillsBridgeId={skillsBridgeId}
          onClose={handleCloseFix}
          onApplied={handleFixApplied}
        />
      )}

      {pendingDownload && (
        <div
          role="status"
          className="fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-3 rounded-lg border border-critical/30 bg-surface px-4 py-3 shadow-pop"
        >
          <p className="text-sm text-ink">
            {verifyCount} AI-added {verifyCount === 1 ? "claim is" : "claims are"} unverified. Review or download anyway.
          </p>
          <button
            type="button"
            onClick={() => {
              setPendingDownload(null);
              const firstVerify = reviewItems.find((i) => i.status === "open" && i.severity === "verify");
              setPanelTab("change");
              setPanelOpen(true);
              if (firstVerify) selectItem(firstVerify.id);
            }}
            className="rounded border border-accent bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => {
              const format = pendingDownload;
              setPendingDownload(null);
              onDownload(format);
            }}
            className="rounded border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Download anyway
          </button>
        </div>
      )}

      <VersionHistorySlideOver
        isOpen={showVersionHistory}
        resumeId={resumeId}
        onClose={() => setShowVersionHistory(false)}
        onRestore={handleVersionRestored}
      />
    </div>
  );
}
