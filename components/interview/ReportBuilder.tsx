"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon, CircleIcon, AlertCircleIcon } from "@/components/ui/icons/LucideIcons";
import { clsx } from "@/lib/utils";
import { trackFunnelEvent } from "@/lib/analytics";
import type { InterviewReport } from "@/types";

const STEPS = [
  { at: 0, label: "Adding up your scores" },
  { at: 3, label: "Finding patterns" },
  { at: 7, label: "Writing your next steps" },
];
const POLL_MS = 2000;
/** Longer than the report route's maxDuration (80s), so a slow build isn't given up on early. */
const GIVE_UP_MS = 90_000;

/**
 * "Building your report": starts the build, then polls its status every 2s (up to 90s). The build
 * request itself may outlive a dropped connection, so the poll is what the screen trusts. A
 * failure never asks for anything to be answered again.
 */
export function ReportBuilder({ sessionId, onReady }: { sessionId: string; onReady: (report: InterviewReport) => void }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [failReason, setFailReason] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const retry = useCallback(() => {
    setFailed(false);
    setFailReason(null);
    setElapsed(0);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let done = false;
    const started = Date.now();
    const finish = (report: InterviewReport | null, reason?: string) => {
      if (done) return;
      done = true;
      if (report) {
        trackFunnelEvent("interview_report_ready", { ms: Date.now() - started });
        onReadyRef.current(report);
      } else {
        trackFunnelEvent("interview_report_failed");
        setFailReason(reason ?? null);
        setFailed(true);
      }
    };

    fetch(`/api/interview/sessions/${sessionId}/report`, { method: "POST" })
      .then(async (res) => ({ res, data: await res.json().catch(() => ({})) }))
      .then(({ res, data }) => {
        if (data?.report_status === "ready" && data.report) finish(data.report);
        else if (data?.report_status === "failed") finish(null);
        // A refusal (rate limit, out of credits) never starts a build, so waiting would be pointless.
        else if (!res.ok && res.status !== 202) finish(null, data?.error);
      })
      .catch(() => {
        // Connection dropped: the poll below still finds out how the build went.
      });

    const poll = setInterval(async () => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
      if (done) return;
      if (Date.now() - started > GIVE_UP_MS) {
        finish(null);
        return;
      }
      try {
        const res = await fetch(`/api/interview/sessions/${sessionId}/report`);
        const data = await res.json();
        if (data.report_status === "ready" && data.report) finish(data.report);
        else if (data.report_status === "failed") finish(null);
      } catch {
        // Try again on the next tick.
      }
    }, POLL_MS);

    return () => {
      done = true;
      clearInterval(poll);
    };
  }, [sessionId, attempt]);

  if (failed) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-critical/30 bg-critical-soft p-6">
        <p className="flex items-center gap-2 text-base font-semibold text-ink">
          <AlertCircleIcon className="h-5 w-5 text-critical" /> We couldn&apos;t build your report. Your answers are saved.
        </p>
        {failReason && <p className="text-sm text-ink-secondary">{failReason}</p>}
        <Button variant="primary" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  const current = [...STEPS].reverse().findIndex((s) => elapsed >= s.at);
  const activeIndex = STEPS.length - 1 - current;

  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6 shadow-sm">
      <h1 className="font-display text-2xl font-semibold text-ink">Building your report</h1>
      <ol className="flex flex-col gap-2">
        {STEPS.map((step, i) => (
          <li
            key={step.label}
            className={clsx(
              "flex items-center gap-2 text-sm",
              i < activeIndex ? "text-success" : i === activeIndex ? "font-semibold text-ink" : "text-ink-muted"
            )}
          >
            {i < activeIndex ? <CheckIcon className="h-4 w-4" /> : <CircleIcon className="h-3.5 w-3.5" />}
            {step.label}
          </li>
        ))}
      </ol>
    </div>
  );
}
