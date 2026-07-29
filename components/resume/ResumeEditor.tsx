"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ResumeEditorForm } from "@/components/resume/ResumeEditorForm";
import { TemplatePicker } from "@/components/resume/TemplatePicker";
import { ContentScorePanel } from "@/components/resume/ContentScorePanel";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { getTemplateDefinition } from "@/lib/resume/templateRegistry";
import type { ContentScoreBreakdown, ContentScoreIssue, ResumeContent, Template } from "@/types";

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
          <p className="text-xs text-amber-700">
            Content score limit reached for this resume —{" "}
            <Link href="/upgrade" className="font-medium underline">
              upgrade to re-score
            </Link>
            .
          </p>
        )}
        {contentScoreError && <p className="text-xs text-red-600">{contentScoreError}</p>}
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

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {warnings.map((warning) => (
              <span
                key={warning}
                className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-800"
              >
                {warning}
              </span>
            ))}
          </div>
          <span className="text-xs text-gray-400">
            {status === "saving" && "Saving…"}
            {status === "saved" && templateStatus !== "saving" && "Saved"}
            {status === "error" && <span className="text-red-600">{error ?? "Failed to save"}</span>}
            {templateStatus === "saving" && "Saving template…"}
            {templateStatus === "error" && <span className="text-red-600">Failed to save template</span>}
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <ResumeEditorForm resumeId={resumeId} resume={resume} onChange={setResume} />
          <div className="lg:sticky lg:top-6 lg:self-start">
            <article className="mx-auto w-full max-w-[210mm] overflow-hidden rounded-lg border border-gray-200 bg-white p-10 shadow-sm">
              <PreviewTemplate resume={resume} />
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}
