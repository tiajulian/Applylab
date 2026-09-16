"use client";

import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ResumePreviewPane, type ResumePreviewPaneHandle } from "@/components/resume/ResumePreviewPane";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { EditorToolbar } from "@/components/resume/EditorToolbar";
import { ReviewCounter } from "@/components/resume/ReviewCounter";
import { VersionHistorySlideOver } from "@/components/resume/VersionHistorySlideOver";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { useResumeHistory } from "@/lib/hooks/useResumeHistory";
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

  // Jumps the preview to the page containing a clicked section (see BaseResumeTemplate's
  // getZoneProps) - a convenience for multi-page resumes, independent of editing itself.
  const [activeSection, setActiveSection] = useState<string>("experience");

  const [flags, setFlags] = useState<FactCheckFlag[]>([...initialFactCheckFlags, ...initialBridgeFactCheckFlags]);
  const [activeTargetKey, setActiveTargetKey] = useState<string | null>(null);
  const [openFix, setOpenFix] = useState<{ targetKey: string | null; flags: FactCheckFlag[]; anchorRect: DOMRect | null } | null>(
    null
  );
  // Computed once at mount so a fully-resolved queue reads as a completed task ("All set") rather
  // than as an absent feature the user never sees any trace of - see ReviewCounter.tsx.
  const [hadItemsToReview] = useState(() => flags.length > 0);
  const previewPaneRef = useRef<ResumePreviewPaneHandle>(null);

  // Group targeted flags by their exact field so a bullet carrying two stacked flags still reads
  // as "1 to review", not "2" - matches the pre-canvas implementation this counter revives.
  const { targetableCount, untargetableFlags } = useMemo(() => {
    const targetKeys = new Set(flags.filter((f) => f.target).map((f) => factCheckTargetKey(f.target!)));
    return { targetableCount: targetKeys.size, untargetableFlags: flags.filter((f) => !f.target) };
  }, [flags]);

  function handleJumpNext() {
    if (previewPaneRef.current?.jumpToNextFlag()) return;
    if (untargetableFlags.length > 0) {
      setActiveTargetKey(null);
      setOpenFix({ targetKey: null, flags: [untargetableFlags[0]], anchorRect: null });
    }
  }

  // Stable across the per-keystroke re-renders typing anywhere in the resume causes - passed to
  // ResumePreviewPane's useImperativeHandle, which recreates its exposed jumpToNextFlag whenever
  // this identity changes, so an inline arrow here would defeat that memoisation on every keystroke.
  const handleHighlightActivate = useCallback(
    (key: string, rect: DOMRect) => {
      setActiveTargetKey(key);
      setOpenFix({ targetKey: key, flags: flags.filter((f) => f.target && factCheckTargetKey(f.target) === key), anchorRect: rect });
    },
    [flags]
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

      <div className="shrink-0 pb-3">
        <ReviewCounter
          targetableCount={targetableCount}
          untargetableFlags={untargetableFlags}
          hadItemsInitially={hadItemsToReview}
          onJumpNext={handleJumpNext}
          onSelectUntargetable={(flag) => {
            setActiveTargetKey(null);
            setOpenFix({ targetKey: null, flags: [flag], anchorRect: null });
          }}
        />
      </div>

      <div className="h-full min-h-0 flex-1 overflow-hidden">
        <ResumePreviewPane
          ref={previewPaneRef}
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
          onSectionClick={setActiveSection}
          onHighlightActivate={handleHighlightActivate}
          onPageCountChange={setTotalPages}
          editable
          resumeId={resumeId}
          onFieldChange={(next) => dispatchTransient({ type: "REPLACE_CONTENT", content: next })}
          onFieldCommit={(next) => commit({ type: "REPLACE_CONTENT", content: next })}
          onFieldBlur={onFieldBlur}
          profileProjects={profileProjects}
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

      <VersionHistorySlideOver
        isOpen={showVersionHistory}
        resumeId={resumeId}
        onClose={() => setShowVersionHistory(false)}
        onRestore={handleVersionRestored}
      />
    </div>
  );
}
