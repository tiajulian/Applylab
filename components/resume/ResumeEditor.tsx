"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ResumeEditorForm } from "@/components/resume/ResumeEditorForm";
import { TemplatePicker } from "@/components/resume/TemplatePicker";
import { FontSizeStepper } from "@/components/resume/FontSizeStepper";
import { VersionHistoryPanel } from "@/components/resume/VersionHistoryPanel";
import { ReviewCounter } from "@/components/resume/ReviewCounter";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { ChooseTemplateModal } from "@/components/resume/ChooseTemplateModal";

import { useAutosave } from "@/lib/hooks/useAutosave";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { clampFontSizePt, DEFAULT_DENSITY, type FontSizePt } from "@/lib/resume/templateDensity";
import { trackFunnelEvent } from "@/lib/analytics";
import { factCheckTargetKey } from "@/types";
import type { CanonicalTemplate, ContentScoreBreakdown, ContentScoreIssue, FactCheckFlag, ProjectEntry, Resume, ResumeContent, Template } from "@/types";


function getWarnings(resume: ResumeContent): string[] {
  const warnings: string[] = [];
  if (!resume.contact.name.trim()) warnings.push("Full name is empty.");
  if (resume.experience.length === 0) warnings.push("No work experience listed.");
  if (resume.skills.length === 0) warnings.push("No skills listed.");
  return warnings;
}

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
  // Owned by the parent (ResumeWorkspace), not this component - the paid "Score resume" action
  // there updates both this and the ATS score in one place. Free users still trigger a scoring
  // run from here (handleScoreContent below), just writing through these same setters.
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
  const previewRef = useRef<HTMLElement>(null);

  const [flags, setFlags] = useState<FactCheckFlag[]>([...initialFactCheckFlags, ...initialBridgeFactCheckFlags]);
  const [hadItemsToReview] = useState(() => flags.length > 0);
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

    // Ignore this response if a newer template selection has since been made — otherwise a
    // slow/failed response for an earlier click could roll the UI back over a later choice.
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


    // Ignore this response if a newer font-size pick has since been made — otherwise a
    // slow/failed response for an earlier click could roll the UI back over a later choice.
    if (requestId !== fontSizeRequestId.current) return;

    if (!response.ok) {
      setFontSizePt(previous);
      setFontSizeStatus("error");
      return;
    }

    setFontSizeStatus("saved");
  }

  // Restoring an older version overwrites resume_content server-side, which also clears
  // content_score/breakdown/issues there (a score describing bytes that no longer exist is
  // worse than no score) — reflect that cleared state here immediately rather than leaving a
  // stale score visible until the next page load. content_score_count is deliberately NOT
  // touched by restore, so this doesn't reset it either.
  function handleRestore(updatedResume: Resume) {
    if (updatedResume.resume_content) {
      setResume(updatedResume.resume_content);
    }
    setContentScore(updatedResume.content_score);
    setContentScoreBreakdown(updatedResume.content_score_breakdown);
    setContentScoreIssues(updatedResume.content_score_issues);
  }

  // One highlight per rendered element, not per raw flag - a bullet carrying two stacked flags
  // (e.g. an untraceable number AND unconfirmed bridge-claim language) is one thing to review,
  // not two, so flags are grouped by the DOM span they map to before anything is counted or
  // rendered as a highlight.
  const targetableFlags = flags.filter((f) => f.target);
  const untargetableFlags = flags.filter((f) => !f.target);
  const flagsByTargetKey = new Map<string, FactCheckFlag[]>();
  for (const f of targetableFlags) {
    const key = factCheckTargetKey(f.target!);
    flagsByTargetKey.set(key, [...(flagsByTargetKey.get(key) ?? []), f]);
  }
  const highlights: Record<string, "flagged" | "active"> = Object.fromEntries(
    Array.from(flagsByTargetKey.keys()).map((key) => [key, key === activeTargetKey ? "active" : "flagged"])
  );

  function openFixForTarget(key: string, rect: DOMRect | null) {
    setActiveTargetKey(key);
    setOpenFix({ targetKey: key, flags: flagsByTargetKey.get(key) ?? [], anchorRect: rect });
  }

  /** Finds the next highlighted element in DOM order inside the preview and opens its fix panel;
   * cycles back to the first once it reaches the end. Falls back to the first untargetable flag
   * (as a centered modal, no anchor rect) when there's nothing left on the preview itself to
   * jump to - the only way to reach e.g. a referee flag, which has no rendered span at all. */
  function handleJumpNext() {
    const container = previewRef.current;
    if (container) {
      const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-fc-target]"));
      const candidates = elements.filter((el) => flagsByTargetKey.has(el.dataset.fcTarget ?? ""));
      if (candidates.length > 0) {
        const currentIndex = candidates.findIndex((el) => el.dataset.fcTarget === activeTargetKey);
        const next = candidates[(currentIndex + 1) % candidates.length];
        const key = next.dataset.fcTarget as string;
        next.scrollIntoView({ behavior: "smooth", block: "center" });
        openFixForTarget(key, next.getBoundingClientRect());
        return;
      }
    }
    if (untargetableFlags.length > 0) {
      setActiveTargetKey(null);
      setOpenFix({ targetKey: null, flags: [untargetableFlags[0]], anchorRect: null });
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

  const warnings = useMemo(() => getWarnings(resume), [resume]);
  const currentTemplateDef = getTemplateDefinition(template);
  const PreviewTemplate = currentTemplateDef.component;
  const contentScoreCapped = !isPaidPlan && contentScoreCount >= 1;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <StaggerList className="flex flex-wrap gap-2">
            {warnings.map((warning) => (
              <StaggerItem key={warning}>
                <Badge variant="attention">{warning}</Badge>
              </StaggerItem>
            ))}
          </StaggerList>
          <span className="text-xs text-ink-muted">
            {status === "saving" && "Saving…"}
            {status === "saved" && templateStatus !== "saving" && fontSizeStatus !== "saving" && "Saved"}
            {status === "error" && <span className="text-critical">{error ?? "Failed to save"}</span>}
            {templateStatus === "saving" && "Saving template…"}
            {templateStatus === "error" && <span className="text-critical">Failed to save template</span>}
            {fontSizeStatus === "saving" && "Saving font size…"}
            {fontSizeStatus === "error" && <span className="text-critical">Failed to save font size</span>}
          </span>
        </div>

        {/* Persistent Template Switcher & Formatting Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-paper/50 p-2.5 sm:px-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Template:</span>
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="inline-flex items-center gap-1.5 rounded border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-ink shadow-xs transition-colors hover:bg-paper-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className={`h-2 w-2 rounded-full ${currentTemplateDef.accentClassName}`} />
              <span>{currentTemplateDef.name}</span>
              <span className="text-ink-muted">▾</span>
            </button>
            <span className="hidden sm:inline text-xs text-ink-muted">· {currentTemplateDef.voice}</span>
          </div>

          <div className="flex items-center gap-3">
            <FontSizeStepper value={fontSizePt} onChange={handleSelectFontSize} disabled={fontSizeStatus === "saving"} />
          </div>
        </div>

        <ChooseTemplateModal
          isOpen={showTemplateModal}
          selectedTemplate={template}
          selectedAccentColor={accentColor}
          onSelect={handleSelectTemplate}
          onClose={() => setShowTemplateModal(false)}
        />

        <ReviewCounter
          targetableCount={flagsByTargetKey.size}
          untargetableFlags={untargetableFlags}
          hadItemsInitially={hadItemsToReview}
          onJumpNext={handleJumpNext}
          onSelectUntargetable={(flag) => {
            setActiveTargetKey(null);
            setOpenFix({ targetKey: null, flags: [flag], anchorRect: null });
          }}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ResumeEditorForm
            resumeId={resumeId}
            resume={resume}
            profileProjects={profileProjects}
            onChange={setResume}
          />
          {/* Capped to the viewport height with its own scroll, rather than growing to the
              preview's full (often much taller) natural height: a grid row stretches to the
              tallest cell, so an uncapped preview forced the shorter form column to stretch with
              it, leaving a large blank gap below wherever the form's content happened to end. */}
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
            <article
              ref={previewRef}
              className="mx-auto w-full max-w-[210mm] overflow-hidden rounded border border-border bg-surface p-10 shadow-sm"
            >
              <PreviewTemplate
                resume={resume}
                density={{ ...DEFAULT_DENSITY, fontPt: fontSizePt }}
                accentColor={accentColor}
                highlights={highlights}
                onHighlightActivate={(key, rect) => openFixForTarget(key, rect)}
              />
            </article>
          </div>
        </div>

      </div>

      {/* Template, formatting, scoring and history - secondary to content and the review queue
          above, so they sit below rather than in the first slot a new user engages with. */}
      <div className="flex flex-col gap-6 border-t border-border pt-6">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink">Resume Templates</h3>
          <p className="mb-4 text-xs text-ink-secondary">
            Switch template instantly at any time. All formatting is ATS-safe and preserves your entire resume content.
          </p>
          <TemplatePicker selected={template} onSelect={handleSelectTemplate} />
        </div>


        {/* Lightweight read-only score summary deep-linking to dedicated /resume/[id]/review */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft font-display text-sm font-bold text-accent">
                {contentScore !== null ? contentScore : "AI"}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-ink">AI Resume Review</span>
                <span className="text-xs text-ink-muted">
                  {contentScore !== null
                    ? `Overall Content Score: ${contentScore}/100 • 5-pillar diagnostic available`
                    : "Run a full 5-pillar diagnostic review (ATS, writing, content, job tailoring & readiness)"}
                </span>
              </div>
            </div>
            <Link href={`/resume/${resumeId}/review`}>
              <Button type="button" variant="outline" size="sm">
                {contentScore !== null ? "View Full Review →" : "Open AI Review →"}
              </Button>
            </Link>
          </div>
        </div>

        <VersionHistoryPanel resumeId={resumeId} onRestore={handleRestore} />
      </div>


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
