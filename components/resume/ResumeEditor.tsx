"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { ResumeEditorForm } from "@/components/resume/ResumeEditorForm";
import { TemplatePicker } from "@/components/resume/TemplatePicker";
import { ContentScorePanel } from "@/components/resume/ContentScorePanel";
import { VersionHistoryPanel } from "@/components/resume/VersionHistoryPanel";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import type { ContentScoreBreakdown, ContentScoreIssue, Resume, ResumeContent, Template } from "@/types";

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
  initialContentScore,
  initialContentScoreBreakdown,
  initialContentScoreIssues,
  initialContentScoreCount,
}: {
  resumeId: string;
  initialResumeContent: ResumeContent;
  initialTemplate: Template;
  isPaidPlan: boolean;
  initialContentScore: number | null;
  initialContentScoreBreakdown: ContentScoreBreakdown | null;
  initialContentScoreIssues: ContentScoreIssue[];
  initialContentScoreCount: number;
}) {
  const [resume, setResume] = useState(initialResumeContent);
  const [template, setTemplate] = useState<Template>(initialTemplate);
  const [templateStatus, setTemplateStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const templateRequestId = useRef(0);

  const [contentScore, setContentScore] = useState<number | null>(initialContentScore);
  const [contentScoreBreakdown, setContentScoreBreakdown] = useState<ContentScoreBreakdown | null>(
    initialContentScoreBreakdown
  );
  const [contentScoreIssues, setContentScoreIssues] = useState<ContentScoreIssue[]>(initialContentScoreIssues);
  const [contentScoreCount, setContentScoreCount] = useState(initialContentScoreCount);
  const [isScoringContent, setIsScoringContent] = useState(false);
  const [contentScoreLimitReached, setContentScoreLimitReached] = useState(false);
  const [contentScoreError, setContentScoreError] = useState<string | null>(null);

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

  const warnings = useMemo(() => getWarnings(resume), [resume]);
  const PreviewTemplate = getTemplateDefinition(template).component;
  const contentScoreCapped = !isPaidPlan && contentScoreCount >= 1;

  return (
    <div className="flex flex-col gap-6">
      <TemplatePicker selected={template} isPaidPlan={isPaidPlan} onSelect={handleSelectTemplate} />

      <div className="flex flex-col gap-3">
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

        <div className="grid gap-6 lg:grid-cols-2">
          <ResumeEditorForm resumeId={resumeId} resume={resume} onChange={setResume} />
          {/* Capped to the viewport height with its own scroll, rather than growing to the
              preview's full (often much taller) natural height: a grid row stretches to the
              tallest cell, so an uncapped preview forced the shorter form column to stretch with
              it, leaving a large blank gap below wherever the form's content happened to end. */}
          <div className="lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:self-start lg:overflow-y-auto">
            <article className="mx-auto w-full max-w-[210mm] overflow-hidden rounded border border-border bg-surface p-10 shadow-sm">
              <PreviewTemplate resume={resume} />
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
