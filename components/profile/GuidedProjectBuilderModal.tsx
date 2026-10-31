"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { CanvasSheet } from "@/components/resume/canvas/CanvasSheet";
import { LimitReachedInline } from "@/components/upgrade/LimitReachedInline";
import { FreeUsesLeft } from "@/components/upgrade/FreeUsesLeft";
import { refreshFreeUsage } from "@/lib/hooks/useFreeUsesLeft";
import { useAccountGate } from "@/components/auth/AccountGate";
import type { ProjectEnhanceRequest, ProjectEnhanceResponse } from "@/app/api/projects/enhance/route";
import type { ProjectEntry } from "@/types";

interface GuidedProjectBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectEntry;
  onApply: (enhanced: { description: string; outcome?: string; outcome_metric?: string }) => void;
}

type Status = "form" | "loading" | "ready" | "limit-reached";

/** The description's lines without their list markers - the user's own answer to "what did you do". */
const plainLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[•\-*]\s*/, ""))
    .filter(Boolean)
    .join("\n");

/**
 * Write a profile project's description from three plain questions. The answers start from what the
 * project already says; the suggestion is editable and only replaces the description on "Use this".
 */
export function GuidedProjectBuilderModal({ isOpen, ...props }: GuidedProjectBuilderModalProps) {
  // Mounted only while open, so every opening starts from the project as it is now.
  return isOpen ? <ProjectWriter {...props} /> : null;
}

function ProjectWriter({ onClose, project, onApply }: Omit<GuidedProjectBuilderModalProps, "isOpen">) {
  const { requireAccount } = useAccountGate();
  const [status, setStatus] = useState<Status>("form");
  const [whatItWas, setWhatItWas] = useState("");
  const [whatYouDid, setWhatYouDid] = useState(() => plainLines(project.description ?? ""));
  const [result, setResult] = useState(project.outcome ?? "");
  const [metric, setMetric] = useState(project.outcome_metric ?? "");
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState("");
  const [sentFrom, setSentFrom] = useState<string | null>(null);
  const changedSince = sentFrom !== null && JSON.stringify(project) !== sentFrom;
  const abortRef = useRef<AbortController | null>(null);
  const whatYouDidRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function request() {
    if (abortRef.current && !abortRef.current.signal.aborted) return;
    if (!whatYouDid.trim()) {
      setMissing(true);
      whatYouDidRef.current?.focus();
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setError(null);
    setSentFrom(JSON.stringify(project));
    const body: ProjectEnhanceRequest = {
      title: project.title.trim(),
      context: project.context?.trim(),
      timeframe: project.timeframe?.trim(),
      isCurrent: /\b(present|current|ongoing|now)\b/i.test(project.timeframe ?? ""),
      tools: project.tools ?? [],
      whatItWas: whatItWas.trim(),
      whatYouDid: whatYouDid.trim(),
      result: result.trim(),
      metric: metric.trim(),
    };
    try {
      const canUseAi = await requireAccount({
        title: "Create your free account to write this project up",
        submitLabel: "Create account & continue",
      });
      if (controller.signal.aborted) return;
      if (!canUseAi) {
        setStatus("form");
        return;
      }
      const response = await fetch("/api/projects/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = (await response.json().catch(() => ({}))) as Partial<ProjectEnhanceResponse> & { error?: string; code?: string };
      if (controller.signal.aborted) return;
      if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
        setStatus("limit-reached");
      } else if (!response.ok || !data.bullets?.length) {
        setError(data.error ?? "Couldn't write this project up. Please try again.");
        setStatus("form");
      } else {
        setSuggestion(data.bullets.map((bullet) => `• ${bullet}`).join("\n"));
        setStatus("ready");
      }
    } catch {
      if (controller.signal.aborted) return;
      setError("Couldn't reach the server. Check your connection and try again.");
      setStatus("form");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      refreshFreeUsage();
    }
  }

  function apply() {
    if (changedSince || !suggestion.trim()) return;
    onApply({
      description: suggestion.trim(),
      outcome: result.trim(),
      outcome_metric: metric.trim(),
    });
    onClose();
  }

  function back() {
    if (changedSince) {
      setWhatYouDid(plainLines(project.description ?? ""));
      setResult(project.outcome ?? "");
      setMetric(project.outcome_metric ?? "");
      setSentFrom(null);
    }
    setStatus("form");
  }

  const isDirty = status === "ready" || status === "loading" || Boolean(whatItWas.trim()) || whatYouDid !== plainLines(project.description ?? "") || result !== (project.outcome ?? "") || metric !== (project.outcome_metric ?? "");

  return (
    <CanvasSheet
      title={`Write up ${project.title.trim() ? `"${project.title.trim()}"` : "this project"}`}
      subtitle="Answer in your own words. Only what you tell us goes in."
      isDirty={isDirty}
      onDismiss={onClose}
      footer={(requestClose) =>
        status === "ready" ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={back}>
              Back
            </Button>
            <Button type="button" size="sm" disabled={changedSince || !suggestion.trim()} onClick={apply}>
              Use this
            </Button>
          </>
        ) : (
          <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
            Cancel
          </Button>
        )
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
        {status === "form" && (
          <form
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void request();
            }}
          >
            <Input label="What was it? (optional)" placeholder="e.g. A fundraiser for the local food bank" value={whatItWas} onChange={(e) => setWhatItWas(e.target.value)} />
            <Textarea
              ref={whatYouDidRef}
              label="What did you do?"
              rows={4}
              placeholder="e.g. Organised volunteers, made the posters in Canva"
              value={whatYouDid}
              onChange={(e) => {
                setWhatYouDid(e.target.value);
                setMissing(false);
              }}
              error={missing ? "Tell us what you did first." : undefined}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
              <Input label="What happened? (optional)" placeholder="e.g. Filled the pantry for a month" value={result} onChange={(e) => setResult(e.target.value)} />
              <Input label="A number, if you have one" placeholder="e.g. 40 volunteers" value={metric} onChange={(e) => setMetric(e.target.value)} />
            </div>
            {error && (
              <p role="alert" className="text-sm font-medium text-critical">
                {error}
              </p>
            )}
            <div>
              <Button type="submit" size="sm">
                <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Write it up
                <FreeUsesLeft feature="project-enhance" />
              </Button>
            </div>
          </form>
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <p className="text-sm text-ink-secondary" role="status">
              Writing from your answers…
            </p>
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        )}

        {status === "ready" && (
          <>
            {changedSince && <p role="alert" className="text-sm text-ink-secondary">Your project changed since you asked. Go back and try again using your latest details.</p>}
            <Textarea label="Suggested description (you can edit it)" rows={6} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
          </>
        )}

        {status === "limit-reached" && (
          <LimitReachedInline title="You've used your free project help" message="Go Pro for unlimited help writing up projects. You can still write it yourself." />
        )}
      </div>
    </CanvasSheet>
  );
}
