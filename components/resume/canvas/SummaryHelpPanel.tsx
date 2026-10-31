"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { LimitReachedInline } from "@/components/upgrade/LimitReachedInline";
import { CanvasSheet } from "@/components/resume/canvas/CanvasSheet";
import { refreshFreeUsage, useFreeUsesLeft } from "@/lib/hooks/useFreeUsesLeft";
import { trackFunnelEvent } from "@/lib/analytics";
import type { ResumeContent } from "@/types";

type Status = "form" | "loading" | "suggestion" | "limit-reached";

/**
 * Write or improve the resume summary with AI, from what's already on the resume plus anything the
 * user adds. Nothing is spent until they click, and nothing changes on the resume until they apply
 * the suggestion - which they can edit first.
 */
export function SummaryHelpPanel({
  resumeId,
  currentSummary,
  targetTitle,
  resumeContent,
  onApply,
  onClose,
}: {
  resumeId: string;
  currentSummary: string;
  targetTitle: string;
  resumeContent?: ResumeContent;
  onApply: (summary: string) => void;
  onClose: () => void;
}) {
  const isNew = !currentSummary.trim();
  const usesLeft = useFreeUsesLeft("resume-summary");
  const [status, setStatus] = useState<Status>("form");
  const [targetRole, setTargetRole] = useState(targetTitle);
  const [notes, setNotes] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  // The summary the suggestion was written from: if the user edits the canvas meanwhile, applying
  // must not silently replace their newer text.
  const [sentFrom, setSentFrom] = useState("");
  const [sentContent, setSentContent] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const changedSince = status === "suggestion" && (currentSummary !== sentFrom || (sentContent !== null && JSON.stringify(resumeContent) !== sentContent));

  useEffect(() => {
    trackFunnelEvent("summary_help_opened", { isNew });
    return () => abortRef.current?.abort();
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function request() {
    if (status === "loading") return;
    if (usesLeft === 0) {
      setStatus("limit-reached");
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus("loading");
    setMessage(null);
    setSentFrom(currentSummary);
    setSentContent(resumeContent ? JSON.stringify(resumeContent) : null);
    try {
      const response = await fetch(`/api/resume/${resumeId}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSummary, targetRole: targetRole.trim(), notes: notes.trim(), resumeContent }),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) return;
      if (response.status === 403 && data.code === "FREE_LIMIT_REACHED") {
        setStatus("limit-reached");
      } else if (!response.ok) {
        setMessage(data.error ?? "Couldn't write a summary. Please try again.");
        setStatus("form");
      } else if (data.needsMoreDetail) {
        setMessage(data.message);
        setStatus("form");
      } else if (typeof data.summary === "string" && data.summary.trim()) {
        setSuggestion(data.summary);
        setStatus("suggestion");
        trackFunnelEvent("summary_help_suggested", { isNew });
      } else {
        setMessage("Couldn't write a summary. Please try again.");
        setStatus("form");
      }
    } catch {
      if (controller.signal.aborted) return;
      setMessage("Couldn't reach the server. Check your connection and try again.");
      setStatus("form");
    } finally {
      refreshFreeUsage();
    }
  }

  function apply() {
    if (!suggestion.trim() || changedSince) return;
    onApply(suggestion.trim());
    trackFunnelEvent("summary_help_applied", { isNew, replacedNewerEdits: changedSince });
    onClose();
  }

  const isDirty = status === "suggestion" || status === "loading" || notes.trim().length > 0 || targetRole !== targetTitle;

  return (
    <CanvasSheet
      title={isNew ? "Write your summary" : "Improve your summary"}
      placement="side"
      subtitle="Written from what's on your resume. Nothing is added that isn't true."
      isDirty={isDirty}
      onDismiss={() => {
        trackFunnelEvent("summary_help_dismissed", { hadSuggestion: status === "suggestion" });
        onClose();
      }}
      footer={(requestClose) =>
        status === "suggestion" ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={requestClose}>
              Keep mine
            </Button>
            {changedSince ? (
              <Button type="button" size="sm" onClick={() => setStatus("form")}>Try again</Button>
            ) : (
              <Button type="button" size="sm" disabled={!suggestion.trim()} onClick={apply}>
                {isNew ? "Use this summary" : "Replace my summary"}
              </Button>
            )}
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
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void request();
            }}
          >
            <Input autoFocus label="Role you're aiming for (optional)" placeholder="e.g. Office Administrator" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} />
            <div className="flex flex-col gap-1">
              <Textarea
                label={isNew ? "Anything else we should know? (optional)" : "What should change? (optional)"}
                rows={3}
                placeholder={isNew ? "e.g. I'm moving from retail into admin work" : "e.g. Make it shorter, mention my customer service"}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <p className="text-xs text-ink-muted">Only real facts. We won&rsquo;t add anything you haven&rsquo;t told us.</p>
            </div>
            {message && (
              <p role="alert" className="text-sm font-medium text-critical">
                {message}
              </p>
            )}
            <div>
              <Button type="submit" size="sm">
                <SparklesIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {usesLeft === 0 ? "See summary options" : isNew ? "Write my summary" : "Improve my summary"}
                {usesLeft !== null && <span className="font-normal opacity-75"> · {usesLeft} free {usesLeft === 1 ? "use" : "uses"}</span>}
              </Button>
            </div>
          </form>
        )}

        {status === "loading" && (
          <div className="flex flex-col gap-2" aria-busy="true">
            <p className="text-sm text-ink-secondary" role="status">
              Writing from your resume…
            </p>
            <Skeleton className="h-28 w-full rounded-lg" />
          </div>
        )}

        {status === "suggestion" && (
          <div className="flex flex-col gap-3">
            <Textarea label="Suggested summary (you can edit it)" rows={6} value={suggestion} onChange={(e) => setSuggestion(e.target.value)} />
            {changedSince && (
              <p role="alert" className="rounded-lg border border-attention/30 bg-attention-soft px-3.5 py-2.5 text-sm text-ink">
                Your summary changed while this was being written. Try again using your latest text.
              </p>
            )}
            {!isNew && (
              <div className="rounded-lg bg-paper-deep px-3.5 py-3 text-sm text-ink-secondary">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Your current summary</p>
                <p className="mt-1 whitespace-pre-line">{currentSummary}</p>
              </div>
            )}
          </div>
        )}

        {status === "limit-reached" && (
          <LimitReachedInline
            title="You've used your free summary"
            message="Upgrade to write and improve your summary as often as you like. You can still edit it yourself on the page."
          />
        )}
      </div>
    </CanvasSheet>
  );
}
