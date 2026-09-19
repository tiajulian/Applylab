"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ResumePreviewPane, type ResumePreviewPaneHandle } from "@/components/resume/ResumePreviewPane";
import { ActionRail } from "@/components/resume/ActionRail";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { ReviewHighlightContext } from "@/components/templates/shared";
import { ReviewPanel, type ReviewTab } from "@/components/resume/reviewpanel/ReviewPanel";
import { chipLabel, chipState } from "@/components/resume/reviewpanel/ReviewChip";
import { effectiveSectionOrder, type ReorderableResumeSection } from "@/lib/resume/resumeSections";
import { EditorToolbar } from "@/components/resume/EditorToolbar";
import { VersionHistorySlideOver } from "@/components/resume/VersionHistorySlideOver";
import { useAutosave, type AutosaveStatus } from "@/lib/hooks/useAutosave";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { useResumeHistory } from "@/lib/hooks/useResumeHistory";
import { useReviewItems } from "@/lib/hooks/useReviewItems";
import { applyFix, applyFixes, revertChange } from "@/lib/review/apply";
import { blockOrder, fieldKeysFor, listBlocks } from "@/lib/review/blocks";
import { buildPassages, countVerify, isCounted } from "@/lib/review/engine";
import type { ProfileSource } from "@/lib/review/provenance";
import type { ReviewItem, ReviewPassage } from "@/lib/review/types";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { canonicalTemplate } from "@/lib/resume/templateMetadata";
import { clampFontSizePt, DEFAULT_DENSITY, type FontSizePt } from "@/lib/resume/templateDensity";
import { applyTrim, buildTrimLadder } from "@/lib/pdf/trimLadder";
import { trackFunnelEvent } from "@/lib/analytics";
import { factCheckTargetKey } from "@/types";
import type {
  CanonicalTemplate,
  ContentScoreBreakdown,
  ContentScoreIssue,
  FactCheckFlag,
  ProjectEntry,
  Resume,
  ResumeContent,
  Template,
} from "@/types";

export function ResumeEditor({
  resumeId,
  initialResumeContent,
  profileProjects = [],
  profile = null,
  initialTemplate,
  initialFontSizePt,
  isPaidPlan,
  initialFactCheckFlags,
  initialBridgeFactCheckFlags,
  skillsBridgeId,
  atsScore,
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
  profileProjects?: ProjectEntry[];
  /** The Career Profile the review panel compares AI-tailored bullets against. */
  profile?: ProfileSource | null;
  initialTemplate: Template;
  initialFontSizePt: number;
  isPaidPlan: boolean;
  initialFactCheckFlags: FactCheckFlag[];
  initialBridgeFactCheckFlags: FactCheckFlag[];
  skillsBridgeId: string | null;
  atsScore?: number | null;
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
  onScoreResume: () => void;
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
    accentColor: null,
    fontSizePt: clampFontSizePt(initialFontSizePt),
  });
  const { resume: snapshot, commit, dispatchTransient, onFieldBlur, canUndo, canRedo } = history;
  const { content: resume, template, accentColor, fontSizePt } = snapshot;

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const templateRequestId = useRef(0);
  const [fontSizeStatus, setFontSizeStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fontSizeRequestId = useRef(0);
  const [totalPages, setTotalPages] = useState(1);
  // Read-only view toggled from ActionRail's Preview button - BaseResumeTemplate already renders
  // every field as static text (not an EditableField) when editable is false, exactly like the
  // PDF/DOCX export path already relies on, so this reuses that branch rather than adding a new one.
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  // Mirrors ResumePreviewPane's zoom scale for display in ViewSettingsPopover - zoom itself stays
  // driven from there (CSS transform), this is display-only, same pattern as onPageCountChange.
  const [zoomScale, setZoomScale] = useState(1);

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

  // The AI score (atsScore/contentScore) is never auto-recomputed - it's a paid, quota-limited
  // call (see ResumePreviewPane's live-estimate comment). This just tracks whether the resume has
  // changed since the score currently on screen was actually computed, to flag it as outdated
  // rather than silently letting a stale number look current.
  const resumeAtLastScoreRef = useRef(initialResumeContent);
  useEffect(() => {
    resumeAtLastScoreRef.current = resume;
    // Keyed on both atsScore and contentScore (not just one) - React skips a state update whose
    // value is unchanged (e.g. restoring a version whose ats_score happens to numerically match
    // the current one), so relying on either alone could occasionally miss re-snapshotting on a
    // real restore/re-score event. Requiring both to coincidentally match to miss it is
    // negligible in practice. Not re-snapshotting on every resume edit is deliberate - that's the
    // opposite of what "stale" should track.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atsScore, contentScore]);
  const isScoreStale = resume !== resumeAtLastScoreRef.current;

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
  const reviewItems = useMemo(() => {
    const order = blockOrder(blocks);
    return review.items
      .filter((i) => review.analysed.get(i.blockId) === blockTexts.get(i.blockId))
      .sort((a, b) => (order.get(a.blockId) ?? 0) - (order.get(b.blockId) ?? 0) || a.start - b.start);
  }, [review.items, review.analysed, blocks, blockTexts]);
  const passages = useMemo(() => buildPassages(reviewItems), [reviewItems]);
  const passagesByBlock = useMemo(() => {
    const map = new Map<string, ReviewPassage[]>();
    for (const passage of passages) {
      for (const key of fieldKeysFor(passage.blockId)) map.set(key, [...(map.get(key) ?? []), passage]);
    }
    return map;
  }, [passages]);
  const verifyCount = countVerify(reviewItems);
  const chip = chipState(review.phase, passages.length, verifyCount);
  const selectedItem = reviewItems.find((i) => i.id === review.selectedId) ?? null;
  const previewHighlights = useMemo(
    () => Object.fromEntries(passages.map((p) => [p.blockId, selectedItem && p.itemIds.includes(selectedItem.id) ? "active" : "flagged"] as const)),
    [passages, selectedItem]
  );

  const isMobile = useIsMobile(768);
  const chipRef = useRef<HTMLButtonElement>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<ReviewTab>("fix");
  const [pendingDownload, setPendingDownload] = useState<"pdf" | "docx" | null>(null);

  const eventPayload = (item: ReviewItem) => ({ resumeId, ruleId: item.ruleId, kind: item.kind });

  function openPanel() {
    if (panelOpen) return;
    // Land on the tab with something to look at, preferring the more urgent verify items.
    const firstOpen = reviewItems.find((i) => i.status === "open" && i.severity === "verify") ?? reviewItems.find((i) => i.status === "open");
    if (firstOpen) setPanelTab(firstOpen.kind);
    setPanelOpen(true);
    trackFunnelEvent("panel_opened", { resumeId, openCount: passages.length, verifyCount });
  }

  function closePanel() {
    setPanelOpen(false);
    requestAnimationFrame(() => chipRef.current?.focus());
  }

  function fieldFor(blockId: string) {
    for (const key of fieldKeysFor(blockId)) {
      const el = canvasContainerRef.current?.querySelector<HTMLElement>(`[data-fc-target="${key}"]`);
      if (el) return el;
    }
    return null;
  }

  /** Scrolls the preview to the item's text and pulses it once (skipped for reduced-motion users). */
  function revealItem(item: ReviewItem) {
    const el = fieldFor(item.blockId);
    if (!el) return;
    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
    if (!calm && typeof el.animate === "function") {
      el.animate(
        [{ boxShadow: "0 0 0 0 rgba(202,89,51,0.55)" }, { boxShadow: "0 0 0 6px rgba(202,89,51,0)" }],
        { duration: 700, easing: "ease-out" }
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

  function editItem(item: ReviewItem) {
    if (isMobile) setPanelOpen(false);
    const el = fieldFor(item.blockId);
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
    el.focus();
    el.setSelectionRange(item.start, item.end);
  }

  function acceptItem(item: ReviewItem) {
    if (item.kind === "fix") {
      const next = applyFix(resume, item);
      if (!next) return;
      review.analyzeSoon();
      commit({ type: "REPLACE_CONTENT", content: next });
    }
    review.setStatus([item.id], "accepted");
    trackFunnelEvent("item_accepted", eventPayload(item));
  }

  function dismissItem(item: ReviewItem) {
    review.setStatus([item.id], "dismissed");
    trackFunnelEvent("item_dismissed", eventPayload(item));
  }

  function revertItem(item: ReviewItem) {
    const next = revertChange(resume, item);
    if (!next) return;
    review.analyzeSoon();
    commit({ type: "REPLACE_CONTENT", content: next });
    review.setStatus([item.id], "resolved");
    trackFunnelEvent("item_reverted", eventPayload(item));
  }

  /** Accept all / Fix all: every chosen fix in one History step, so one undo takes them all back. */
  function applyBulk(tab: ReviewTab, chosen: ReviewItem[]) {
    if (tab === "fix") {
      const { content, applied } = applyFixes(resume, chosen);
      if (applied.length === 0) return;
      review.analyzeSoon();
      commit({ type: "REPLACE_CONTENT", content });
      review.setStatus(applied.map((i) => i.id), "accepted");
      applied.forEach((i) => trackFunnelEvent("item_accepted", { ...eventPayload(i), bulk: true }));
    } else {
      review.setStatus(chosen.map((i) => i.id), "accepted");
      chosen.forEach((i) => trackFunnelEvent("item_accepted", { ...eventPayload(i), bulk: true }));
    }
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
      if (isForeignInput) return;

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

  function handleSelectAccentColor(next: string | null) {
    commit({ type: "SET_ACCENT_COLOR", accentColor: next });
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

  function handleFitToOnePage() {
    if (fontSizePt > 9.5) {
      handleSelectFontSize(Math.max(9.5, fontSizePt - 0.5) as FontSizePt);
    } else {
      const ladder = buildTrimLadder(resume, fontSizePt);
      if (ladder.length > 1) {
        const trimmed = applyTrim(resume, ladder[1]);
        commit({ type: "APPLY_TRIM", content: trimmed });
      }
    }
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
    setAtsScore(updatedResume.ats_score);
    setContentScore(updatedResume.content_score);
  }

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
        chipLabel={chipLabel(chip, passages.length, verifyCount)}
        isReviewOpen={panelOpen}
        onToggleReview={() => (panelOpen ? closePanel() : openPanel())}
        atsScore={atsScore}
        isPaidPlan={isPaidPlan}
        isScoring={isScoring}
        onScoreResume={onScoreResume}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        sectionOrder={effectiveSectionOrder(resume.section_order, currentTemplateDef.tokens.sectionOrder === "skills_first")}
        onSetSectionOrder={handleSetSectionOrder}
        templateDef={currentTemplateDef}
        onOpenTemplateModal={() => setShowTemplateModal(true)}
        isModernTemplate={template === "modern"}
        accentColor={accentColor}
        onSelectAccentColor={handleSelectAccentColor}
        onOpenVersionHistory={() => setShowVersionHistory(true)}
        totalPages={totalPages}
        onFitToOnePage={handleFitToOnePage}
        zoomPercent={Math.round(zoomScale * 100)}
        onZoomIn={() => previewPaneRef.current?.zoomIn()}
        onZoomOut={() => previewPaneRef.current?.zoomOut()}
        onResetZoom={() => previewPaneRef.current?.resetZoom()}
        fontSizePt={fontSizePt}
        onSelectFontSize={handleSelectFontSize}
      />

      <div ref={canvasContainerRef} className="flex h-full min-h-0 flex-1 gap-2 overflow-hidden">
        <div className="h-full min-w-0 flex-1">
          <ReviewHighlightContext.Provider value={reviewHighlightValue}>
          <ResumePreviewPane
            ref={previewPaneRef}
            resume={resume}
            templateDef={currentTemplateDef}
            fontSizePt={fontSizePt}
            density={{ ...DEFAULT_DENSITY, fontPt: fontSizePt }}
            accentColor={accentColor}
            atsScore={atsScore}
            isScoreStale={isScoreStale}
            missingKeywords={missingKeywords}
            highlights={previewHighlights}
            activeSection={activeSection}
            onOpenTemplateModal={() => setShowTemplateModal(true)}
            onSectionClick={setActiveSection}
            onHighlightActivate={handleHighlightActivate}
            onPageCountChange={setTotalPages}
            onZoomChange={setZoomScale}
            editable={!isPreviewMode}
            resumeId={resumeId}
            onFieldChange={(next) => dispatchTransient({ type: "REPLACE_CONTENT", content: next })}
            onFieldCommit={(next) => commit({ type: "REPLACE_CONTENT", content: next })}
            onFieldBlur={onFieldBlur}
            profileProjects={profileProjects}
          />
          </ReviewHighlightContext.Provider>
        </div>

        {panelOpen && (
          <ReviewPanel
            items={reviewItems}
            tab={panelTab}
            onTabChange={setPanelTab}
            selectedId={review.selectedId}
            isMobile={isMobile}
            isPaidPlan={isPaidPlan}
            labels={blockLabels}
            texts={blockTexts}
            canAccept={(item) => item.kind === "change" || Boolean(item.after)}
            canRevert={(item) => item.kind === "change" && Boolean(item.before) && blockTexts.get(item.blockId) === item.after}
            hasEvidenceFlow={(item) => item.ruleId.startsWith("factcheck.")}
            onSelect={selectItem}
            onAccept={acceptItem}
            onEdit={editItem}
            onDismiss={dismissItem}
            onRestore={(item) => review.setStatus([item.id], "open")}
            onRevert={revertItem}
            onOpenEvidence={openEvidence}
            onBulkApply={applyBulk}
            onBulkClicked={(tab, count) => trackFunnelEvent("accept_all_clicked", { resumeId, tab, count })}
            onUpgradeClick={() => trackFunnelEvent("upgrade_clicked_from_panel", { resumeId, source: "bulk" })}
            onClose={closePanel}
          />
        )}

        <ActionRail
          isPreviewMode={isPreviewMode}
          onTogglePreview={() => setIsPreviewMode((prev) => !prev)}
          isPaidPlan={isPaidPlan}
          isUnlocked={isUnlocked}
          downloadingFormat={downloadingFormat}
          onDownload={handleDownload}
          onDownloadLocked={onDownloadLocked}
        />
      </div>

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
