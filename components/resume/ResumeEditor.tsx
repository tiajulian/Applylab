"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ResumeEditorForm, type ResumeSectionId } from "@/components/resume/ResumeEditorForm";
import { ResumePreviewPane } from "@/components/resume/ResumePreviewPane";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
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
}) {
  const [resume, setResume] = useState(initialResumeContent);
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [accentColor, setAccentColor] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const templateRequestId = useRef(0);
  const [fontSizePt, setFontSizePt] = useState<FontSizePt>(() => clampFontSizePt(initialFontSizePt));
  const [fontSizeStatus, setFontSizeStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const fontSizeRequestId = useRef(0);

  // Two-way section synchronization (default open: experience)
  const [activeSection, setActiveSection] = useState<ResumeSectionId>("experience");

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
    if (nextAccent !== undefined) {
      setAccentColor(nextAccent);
    }
    if (previous !== next) {
      trackFunnelEvent("template_switched", { resumeId, fromTemplate: previous, toTemplate: next });
    }
    const requestId = ++templateRequestId.current;
    setTemplate(next);
    setTemplateStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: next }),
    });

    if (requestId !== templateRequestId.current) return;

    if (!response.ok) {
      setTemplate(previous);
      setTemplateStatus("error");
      return;
    }

    setTemplateStatus("saved");
  }

  async function handleSelectFontSize(next: FontSizePt) {
    const previous = fontSizePt;
    const requestId = ++fontSizeRequestId.current;
    setFontSizePt(next);
    setFontSizeStatus("saving");

    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ font_size_pt: next }),
    });

    if (requestId !== fontSizeRequestId.current) return;

    if (!response.ok) {
      setFontSizePt(previous);
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
        setResume(trimmed);
      }
    }
  }

  function handleReviewFlags() {
    if (flags.length > 0) {
      setActiveTargetKey(null);
      setOpenFix({ targetKey: null, flags, anchorRect: null });
    }
  }

  function handleFixApplied(updatedResume: Resume) {
    if (updatedResume.resume_content) setResume(updatedResume.resume_content);
    setFlags([...(updatedResume.fact_check_flags ?? []), ...(updatedResume.bridge_fact_check_flags ?? [])]);
    setOpenFix(null);
    setActiveTargetKey(null);
  }

  function handleCloseFix() {
    setOpenFix(null);
    setActiveTargetKey(null);
  }

  const currentTemplateDef = getTemplateDefinition(template);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {/* 2-Column Grid: Form scroller on left, Sheet viewer on right */}
      <div className="grid h-full min-h-0 flex-1 grid-cols-1 gap-6 overflow-hidden min-[1180px]:grid-cols-[minmax(0,460px)_minmax(0,1fr)] max-[1179px]:h-auto max-[1179px]:overflow-visible">
        {/* Left Form Pane: owns the only scroller on desktop */}
        <div className="h-full min-h-0 overflow-y-auto pr-1 max-[1179px]:h-auto max-[1179px]:overflow-visible">
          <ResumeEditorForm
            resumeId={resumeId}
            resume={resume}
            profileProjects={profileProjects}
            openSection={activeSection}
            onSectionChange={setActiveSection}
            flags={flags}
            onReviewFlags={handleReviewFlags}
            onChange={setResume}
          />
        </div>

        {/* Right Preview Pane: one page at a time with fixed nav */}
        <div className="h-full min-h-0 overflow-hidden max-[1179px]:h-auto max-[1179px]:overflow-visible">
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
            onFitToOnePage={handleFitToOnePage}
          />
        </div>
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
    </div>
  );
}
