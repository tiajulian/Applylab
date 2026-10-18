"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BriefcaseIcon, XIcon } from "@/components/ui/icons/LucideIcons";

/** How long after clicking Apply coming back still counts as "back from the ad". */
const ASK_WITHIN_MS = 30 * 60 * 1000;

export interface ApplyTarget {
  title: string;
  /** "" when the listing doesn't name one. */
  company: string;
  url: string;
  /** The tailored resume sent with it, linked on the tracker. */
  resumeId?: string;
}

/**
 * "Did you apply?" after someone opens a job ad to apply. Applying happens on another site, so the
 * question waits until they come back to this tab; one tap then adds the job to Applications
 * (with its link and resume), so tracking never needs a separate trip to the tracker.
 *
 * Call `startApply` from the Apply link's onClick (the link itself opens the ad); render `prompt`.
 */
export function useApplyFollowUp({ onAdded }: { onAdded?: () => void } = {}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [asking, setAsking] = useState<ApplyTarget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Set on click; the prompt shows on the first return to this tab after it, within the time limit.
  const awaitingReturn = useRef<{ target: ApplyTarget; at: number } | null>(null);
  const leftTab = useRef(false);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") {
        if (awaitingReturn.current) leftTab.current = true;
        return;
      }
      if (awaitingReturn.current && leftTab.current) {
        const { target, at } = awaitingReturn.current;
        awaitingReturn.current = null;
        leftTab.current = false;
        // Long after the click it's no longer about that ad (e.g. the ad was opened in a background tab).
        if (Date.now() - at <= ASK_WITHIN_MS) setAsking(target);
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const startApply = useCallback((target: ApplyTarget) => {
    awaitingReturn.current = { target, at: Date.now() };
    leftTab.current = false;
    setAsking(null);
  }, []);

  /** Forget any pending or showing question (e.g. the job was tracked another way). */
  const cancel = useCallback(() => {
    awaitingReturn.current = null;
    setAsking(null);
  }, []);

  async function addToApplications(target: ApplyTarget) {
    setIsSaving(true);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: target.company,
          job_title: target.title,
          job_url: target.url,
          resume_id: target.resumeId,
          status: "applied",
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        // No company (or title) to save it under: the tracker's add form asks for it.
        if (data.needs_details) {
          setAsking(null);
          const params = new URLSearchParams({ add: "1", title: target.title, url: target.url });
          if (target.resumeId) params.set("resume", target.resumeId);
          router.push(`/applications?${params}`);
          return;
        }
        throw new Error(data.error);
      }
      setAsking(null);
      onAdded?.();
      showToast("Added to your Applications", "success");
    } catch (error) {
      showToast((error as Error).message || "Couldn't add it. Try again.", "critical");
    } finally {
      setIsSaving(false);
    }
  }

  const prompt = asking && (
    <div
      role="dialog"
      aria-labelledby="apply-followup-title"
      className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-lg lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-hover"
        >
          <BriefcaseIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="apply-followup-title" className="text-[14.5px] font-semibold text-ink">
            Did you apply?
          </p>
          <p className="mt-0.5 text-[13.5px] leading-snug text-ink-secondary">
            {asking.company ? `${asking.title} at ${asking.company}` : asking.title}. Add it to{" "}
            <Link href="/applications" className="font-medium text-ink underline underline-offset-2">
              Applications
            </Link>{" "}
            so you can keep track of replies.
          </p>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={() => setAsking(null)}
          className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-paper-deep hover:text-ink"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-ink-secondary hover:bg-paper-deep hover:text-ink"
          onClick={() => setAsking(null)}
          disabled={isSaving}
        >
          Not yet
        </Button>
        <Button type="button" size="sm" isLoading={isSaving} onClick={() => void addToApplications(asking)}>
          Yes, add it
        </Button>
      </div>
    </div>
  );

  return { startApply, cancel, prompt };
}
