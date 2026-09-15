"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ResumeEditorForm, type ResumeSectionId } from "@/components/resume/ResumeEditorForm";
import { ResumePreviewPane } from "@/components/resume/ResumePreviewPane";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { EditorToolbar } from "@/components/resume/EditorToolbar";
import { VersionHistorySlideOver } from "@/components/resume/VersionHistorySlideOver";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { useResumeHistory } from "@/lib/hooks/useResumeHistory";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { canonicalTemplate } from "@/lib/resume/templateMetadata";
import { clampFontSizePt, DEFAULT_DENSITY, type FontSizePt } from "@/lib/resume/templateDensity";
import { applyTrim, buildTrimLadder } from "@/lib/pdf/trimLadder";
import { trackFunnelEvent } from "@/lib/analytics";
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
}: {
  resumeId: string;
  initialResumeContent: ResumeContent;
  profileProjects?: ProjectEntry[];
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
}) {
  const history = useResumeHistory({
    content: initialResumeContent,
    template: initialTemplate,
    accentColor: null,
    fontSizePt: clampFontSizePt(initialFontSizePt),
  });
  const { resume: snapshot, commit, dispatchTransient, onFieldBlur, undo, redo, canUndo, canRedo } = history;
  const { content: resume, template, accentColor, fontSizePt } = snapshot;

  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const templateRequestId = useRef(0);
  const [fontSizeStatus, setFontSizeStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fontSizeRequestId = useRef(0);
  const [totalPages, setTotalPages] = useState(1);

  // Two-way section synchronization (default open: experience)
  const [activeSection, setActiveSection] = useState<ResumeSectionId>("experience");

  // Below the 1180px breakpoint the 2-col grid collapses to one column; this picks which
  // pane shows instead of burying the preview under all 9 form sections.
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");

  // Phase 2 internal-only QA gate (commit 5 of the plan): ?canvasPreview=1 swaps the accordion
  // for the real WYSIWYG canvas, off by default for every real user. Read after mount, not during
  // the initial render, so the server-rendered pass (which has no `window`) and the first client
  // render match - avoids a hydration mismatch for what is otherwise a one-line dev flag.
  const [isCanvasPreview, setIsCanvasPreview] = useState(false);
  useEffect(() => {
    setIsCanvasPreview(new URLSearchParams(window.location.search).get("canvasPreview") === "1");
  }, []);

  const [flags, setFlags] = useState<FactCheckFlag[]>([...initialFactCheckFlags, ...initialBridgeFactCheckFlags]);
  const [activeTargetKey, setActiveTargetKey] = useState<string | null>(null);
  const [openFix, setOpenFix] = useState<{ targetKey: string | null; flags: FactCheckFlag[]; anchorRect: DOMRect | null } | null>(
    null
  );

  const { status, error } = useAutosave(resume, async (value) => {
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

  function handleReorderSection(index: number, direction: -1 | 1) {
    commit({ type: "REORDER_SECTION", index, direction });
  }

  function handleReviewFlags() {
    if (flags.length > 0) {
      setActiveTargetKey(null);
      setOpenFix({ targetKey: null, flags, anchorRect: null });
    }
  }

  function handleFixApplied(updatedResume: Resume) {
    if (updatedResume.resume_content) commit({ type: "REPLACE_CONTENT", content: updatedResume.resume_content });
    setFlags([...(updatedResume.fact_check_flags ?? []), ...(updatedResume.bridge_fact_check_flags ?? [])]);
    setOpenFix(null);
    setActiveTargetKey(null);
  }

  function handleCloseFix() {
    setOpenFix(null);
    setActiveTargetKey(null);
  }

  function handleVersionRestored(updatedResume: Resume) {
    if (updatedResume.resume_content) {
      commit({ type: "RESTORE_VERSION", content: updatedResume.resume_content });
    }
    setAtsScore(updatedResume.ats_score);
    setContentScore(updatedResume.content_score);
  }

  const currentTemplateDef = getTemplateDefinition(template);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <EditorToolbar
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        sectionOrder={resume.section_order}
        onReorderSection={handleReorderSection}
        templateDef={currentTemplateDef}
        onOpenTemplateModal={() => setShowTemplateModal(true)}
        isModernTemplate={template === "modern"}
        accentColor={accentColor}
        onSelectAccentColor={handleSelectAccentColor}
        onOpenVersionHistory={() => setShowVersionHistory(true)}
        totalPages={totalPages}
        onFitToOnePage={handleFitToOnePage}
      />

      {isCanvasPreview ? (
        // Phase 2 internal QA only (?canvasPreview=1) - previews the post-cutover layout: the
        // canvas as the sole editing surface, full width, at every breakpoint. Never reached by a
        // real user; the accordion below remains what actually ships until the plan's cutover commit.
        <div className="h-full min-h-0 flex-1 overflow-hidden">
          <ResumePreviewPane
            resume={resume}
            templateDef={currentTemplateDef}
            fontSizePt={fontSizePt}
            density={{ ...DEFAULT_DENSITY, fontPt: fontSizePt }}
            accentColor={accentColor}
            atsScore={atsScore}
            missingKeywords={missingKeywords}
            flags={flags}
            activeTargetKey={activeTargetKey}
            activeSection={activeSection}
            onOpenTemplateModal={() => setShowTemplateModal(true)}
            onSelectFontSize={handleSelectFontSize}
            onSectionClick={(secId) => setActiveSection(secId as ResumeSectionId)}
            onHighlightActivate={(key, rect) => {
              setActiveTargetKey(key);
              setOpenFix({ targetKey: key, flags: flags.filter((f) => f.target), anchorRect: rect });
            }}
            onPageCountChange={setTotalPages}
            editable
            resumeId={resumeId}
            onFieldChange={(next) => dispatchTransient({ type: "REPLACE_CONTENT", content: next })}
            onFieldCommit={(next) => commit({ type: "REPLACE_CONTENT", content: next })}
            onFieldBlur={onFieldBlur}
          />
        </div>
      ) : (
        <>
          {/* Edit/Preview toggle: narrow viewports only, where the grid below is a single column */}
          <div className="mb-3 flex shrink-0 gap-1 rounded-pill border border-border bg-paper-deep/60 p-1 min-[1180px]:hidden">
            <button
              type="button"
              onClick={() => setMobileView("edit")}
              className={`flex-1 rounded-pill py-1.5 text-xs font-semibold transition-colors ${
                mobileView === "edit" ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setMobileView("preview")}
              className={`flex-1 rounded-pill py-1.5 text-xs font-semibold transition-colors ${
                mobileView === "preview" ? "bg-surface text-ink shadow-xs" : "text-ink-muted hover:text-ink"
              }`}
            >
              Preview
            </button>
          </div>

          {/* 2-Column Grid: Form scroller on left, Sheet viewer on right */}
          <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden min-[1180px]:grid-cols-[minmax(0,460px)_minmax(0,1fr)] max-[1179px]:h-auto max-[1179px]:overflow-visible">
            {/* Left Form Pane: owns the only scroller on desktop */}
            <div
              className={`h-full min-h-0 overflow-y-auto pr-1 max-[1179px]:h-auto max-[1179px]:overflow-visible ${
                mobileView === "preview" ? "max-[1179px]:hidden" : ""
              }`}
            >
              <ResumeEditorForm
                resumeId={resumeId}
                resume={resume}
                profileProjects={profileProjects}
                openSection={activeSection}
                onSectionChange={setActiveSection}
                flags={flags}
                onReviewFlags={handleReviewFlags}
                onChange={(next) => dispatchTransient({ type: "REPLACE_CONTENT", content: next })}
                onCommitChange={(next) => commit({ type: "REPLACE_CONTENT", content: next })}
                onFieldBlur={onFieldBlur}
              />
            </div>

            {/* Right Preview Pane: one page at a time with fixed nav */}
            <div
              className={`h-full min-h-0 overflow-hidden max-[1179px]:h-auto max-[1179px]:overflow-visible ${
                mobileView === "edit" ? "max-[1179px]:hidden" : ""
              }`}
            >
              <ResumePreviewPane
                resume={resume}
                templateDef={currentTemplateDef}
                fontSizePt={fontSizePt}
                density={{ ...DEFAULT_DENSITY, fontPt: fontSizePt }}
                accentColor={accentColor}
                atsScore={atsScore}
                missingKeywords={missingKeywords}
                flags={flags}
                activeTargetKey={activeTargetKey}
                activeSection={activeSection}
                isHiddenOnMobile={mobileView === "edit"}
                onOpenTemplateModal={() => setShowTemplateModal(true)}
                onSelectFontSize={handleSelectFontSize}
                onSectionClick={(secId) => {
                  setActiveSection(secId as ResumeSectionId);
                  setMobileView("edit");
                }}
                onHighlightActivate={(key, rect) => {
                  setActiveTargetKey(key);
                  setOpenFix({ targetKey: key, flags: flags.filter((f) => f.target), anchorRect: rect });
                }}
                onPageCountChange={setTotalPages}
              />
            </div>
          </div>
        </>
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

      <VersionHistorySlideOver
        isOpen={showVersionHistory}
        resumeId={resumeId}
        onClose={() => setShowVersionHistory(false)}
        onRestore={handleVersionRestored}
      />
    </div>
  );
}
