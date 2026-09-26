"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import type { SourceIssues } from "@/lib/text/preGenerateCheck";

const MAX_ISSUES_PER_SOURCE = 6;

/**
 * Warn-only heads-up shown before generating: possible spelling or grammar slips in the text the
 * resume is built from. It never blocks; "Continue anyway" always proceeds.
 */
export function PreGenerateCheckModal({
  issues,
  onContinue,
  onCancel,
}: {
  issues: SourceIssues[] | null;
  onContinue: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!issues) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [issues, onCancel]);

  if (!issues) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pre-generate-check-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-xs" onClick={onCancel} />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop">
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <h2 id="pre-generate-check-title" className="font-display text-h3 font-bold text-ink">
            A few things to check first
          </h2>
          <p className="mt-1.5 text-sm text-ink-secondary">
            We found possible spelling or grammar slips. Your resume is built from this text, so fixing them first
            gives a cleaner result. You can also continue as is.
          </p>

          <div className="mt-5 flex flex-col gap-4">
            {issues.map(({ label, issues: sourceIssues }, sourceIndex) => (
              <div key={`${sourceIndex}:${label}`}>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">{label}</h3>
                <ul className="mt-1.5 flex flex-col gap-1 text-sm text-ink-secondary">
                  {sourceIssues.slice(0, MAX_ISSUES_PER_SOURCE).map((issue, issueIndex) => (
                    <li key={issueIndex}>{issue.message}</li>
                  ))}
                  {sourceIssues.length > MAX_ISSUES_PER_SOURCE && (
                    <li className="text-ink-muted">and {sourceIssues.length - MAX_ISSUES_PER_SOURCE} more</li>
                  )}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-5 text-xs text-ink-muted">
            Edit your profile text on the{" "}
            <a href="/profile" target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Profile page
            </a>{" "}
            (opens in a new tab), then refresh this page.
          </p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row-reverse">
            <Button type="button" className="w-full justify-center sm:w-auto" onClick={onContinue}>
              Continue anyway
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-center sm:w-auto"
              onClick={onCancel}
            >
              Go back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
