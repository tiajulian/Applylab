"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ResumeEditorForm } from "@/components/resume/ResumeEditorForm";
import { TemplatePicker } from "@/components/resume/TemplatePicker";
import { ContentScorePanel } from "@/components/resume/ContentScorePanel";
import { VersionHistoryPanel } from "@/components/resume/VersionHistoryPanel";
import { ReviewCounter } from "@/components/resume/ReviewCounter";
import { FactCheckFixPanel } from "@/components/resume/FactCheckFixPanel";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import { factCheckTargetKey } from "@/types";
import type { ContentScoreBreakdown, ContentScoreIssue, FactCheckFlag, Resume, ResumeContent, Template } from "@/types";

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
  initialTemplate,
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
  initialTemplate: Template;
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
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const templateRequestId = useRef(0);
  const previewRef = useRef<HTMLElement>(null);

  const [isScoringContent, setIsScoringContent] = useState(false);
  const [contentScoreLimitReached, setContentScoreLimitReached] = useState(false);
  const [contentScoreError, setContentScoreError] = useState<string | null>(null);

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

  async function handleSelectTemplate(next: Template) {
    const previous = template;
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

  async function handleScoreContent() {
    setIsScoringContent(true);
    setContentScoreError(null);
    setContentScoreLimitReached(false);

    const response = await fetch(`/api/resume/${resumeId}/content-score`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setIsScoringContent(false);

    if (!response.ok) {
      if (response.status === 403) {
        setContentScoreLimitReached(true);
        return;
      }
      setContentScoreError(data.error ?? "Failed to score resume content");
      return;
    }

    setContentScore(data.score);
    setContentScoreBreakdown(data.breakdown);
    setContentScoreIssues(data.issues);
    setContentScoreCount((count) => count + 1);
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
  const PreviewTemplate = getTemplateDefinition(template).component;
  const contentScoreCapped = !isPaidPlan && contentScoreCount >= 1;

  return (
    <div className="flex flex-col gap-6">
      <TemplatePicker selected={template} isPaidPlan={isPaidPlan} onSelect={handleSelectTemplate} />

      <div className="flex flex-col gap-3">
        {/* Paid users score content (and ATS) together via the "Score resume" button in
            ResumeWorkspace's toolbar - this standalone trigger is only needed on the free plan,
            where content-score is the only scoring feature available at all. */}
        {!isPaidPlan && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleScoreContent}
              isLoading={isScoringContent}
              title={contentScoreCapped ? "Upgrade to re-score" : undefined}
            >
              {contentScore !== null ? (contentScoreCapped ? "Re-score content (Pro)" : "Re-score content") : "Score content"}
            </Button>
          </div>
        )}
        {contentScoreLimitReached && (
          <p className="text-xs text-attention">
            Content score limit reached for this resume.{" "}
            <Link href="/upgrade" className="font-medium underline">
              Upgrade to re-score
            </Link>
            .
          </p>
        )}
        {contentScoreError && <p className="text-xs text-critical">{contentScoreError}</p>}
        {contentScore !== null && contentScoreBreakdown && (
          <ContentScorePanel
            resume={resume}
            onChange={setResume}
            score={contentScore}
            breakdown={contentScoreBreakdown}
            issues={contentScoreIssues}
          />
        )}
      </div>

      <VersionHistoryPanel resumeId={resumeId} onRestore={handleRestore} />

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
            {status === "saved" && templateStatus !== "saving" && "Saved"}
            {status === "error" && <span className="text-critical">{error ?? "Failed to save"}</span>}
            {templateStatus === "saving" && "Saving template…"}
            {templateStatus === "error" && <span className="text-critical">Failed to save template</span>}
          </span>
        </div>

        <ReviewCounter
          targetableCount={flagsByTargetKey.size}
          untargetableFlags={untargetableFlags}
          onJumpNext={handleJumpNext}
          onSelectUntargetable={(flag) => {
            setActiveTargetKey(null);
            setOpenFix({ targetKey: null, flags: [flag], anchorRect: null });
          }}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <ResumeEditorForm resumeId={resumeId} resume={resume} onChange={setResume} />
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
                highlights={highlights}
                onHighlightActivate={(key, rect) => openFixForTarget(key, rect)}
              />
            </article>
          </div>
        </div>
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
