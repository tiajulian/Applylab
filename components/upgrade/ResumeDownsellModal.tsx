"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { CheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { trackFunnelEvent } from "@/lib/analytics";

interface ResumeDownsellModalProps {
  isOpen: boolean;
  resumeId: string;
  resumeTitle?: string;
  onClose: () => void;
}

export function ResumeDownsellModal({
  isOpen,
  resumeId,
  resumeTitle,
  onClose,
}: ResumeDownsellModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(`unlock_modal_dismissed_${resumeId}`, "true");
      sessionStorage.setItem(`downsell_dismissed_${resumeId}`, "true");
    } catch {
      // Ignore storage quota/permission issues in private browsing
    }
    trackFunnelEvent("downsell_dismissed", { resumeId, price: 2.99 });
    onClose();
  }, [resumeId, onClose]);

  // Focus trap & keyboard navigation management
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElement.current = document.activeElement as HTMLElement | null;

    // Shift initial focus to the dialog container itself to avoid accidental Enter submissions
    const timeout = setTimeout(() => {
      dialogRef.current?.focus();
    }, 16);

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleDismiss();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === dialogRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(timeout);
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus?.();
    };
  }, [isOpen, handleDismiss]);

  async function handleUnlock() {
    setIsLoading(true);
    setError(null);
    trackFunnelEvent("downsell_paid", { resumeId, price: 2.99, step: "checkout_initiated" });

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "resume_unlock", resumeId }),
      });

      if (response.status === 401) {
        router.push(`/login?redirectedFrom=/resume/${resumeId}`);
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.url) {
        setError(data.error ?? "Failed to start unlock checkout");
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unlock-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/50 backdrop-blur-xs"
            onClick={handleDismiss}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            ref={dialogRef}
            tabIndex={-1}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[440px] max-h-[min(90vh,680px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-border/80 bg-surface p-6 sm:p-8 shadow-pop outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-right sage decorative circle */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-12 -right-12 h-36 w-36 rounded-full bg-success-soft"
            />

            {/* Bottom-left accent decorative circle */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -bottom-14 -left-14 h-40 w-40 rounded-full bg-accent-soft"
            />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 z-10 rounded-full p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>

            {/* 1. Heading & Subhead Group */}
            <div className="relative text-left">
              <h2
                id="unlock-modal-title"
                className="font-display text-2xl sm:text-[26px] font-bold text-ink leading-tight max-w-[15ch]"
              >
                Send this one today.
              </h2>
              <p className="mt-2 text-sm text-ink-muted leading-relaxed max-w-[34ch]">
                {resumeTitle ? (
                  <>
                    Your <strong className="font-semibold text-ink">{resumeTitle}</strong> resume, unlocked once. No subscription.
                  </>
                ) : (
                  <>Your resume, unlocked once. No subscription.</>
                )}
              </p>
            </div>

            {/* 2. Benefits List */}
            <div className="relative mt-[26px] flex flex-col gap-[13px]">
              <div className="flex items-center gap-3">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckIcon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-ink leading-snug">
                  PDF with no watermark
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckIcon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-ink leading-snug">
                  Editable Word file
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                  <CheckIcon className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm font-medium text-ink leading-snug">
                  Yours to keep, re-download any time
                </span>
              </div>
            </div>

            {/* 3. Price Pill */}
            <div className="relative mt-[26px] flex items-center justify-between rounded-full border border-border/60 bg-paper-deep/40 px-5 py-2.5">
              <span className="text-sm text-ink-muted line-through" aria-hidden="true">
                $19 a month
              </span>
              <span className="sr-only">instead of $19 a month</span>
              <div className="ml-auto flex items-baseline gap-1.5">
                <span className="font-display text-[27px] font-bold text-accent tabular-nums leading-none">
                  $2.99
                </span>
                <span className="text-xs font-normal text-ink-muted">once</span>
              </div>
            </div>

            {error && (
              <p className="relative mt-3 text-center text-xs font-semibold text-critical">
                {error}
              </p>
            )}

            {/* 4. Actions & Reassurance */}
            <div className="relative mt-[26px] flex flex-col items-center">
              <Button
                type="button"
                size="lg"
                className="w-full justify-center text-base font-bold shadow-sm"
                onClick={handleUnlock}
                disabled={isLoading}
                isLoading={isLoading}
              >
                {isLoading ? "Opening checkout…" : "Unlock and download"}
              </Button>
              <p className="mt-2 text-center text-xs text-ink-muted">
                Card or Apple Pay, about 20 seconds
              </p>
              <button
                type="button"
                onClick={handleDismiss}
                className="mt-3 inline-flex items-center justify-center rounded-md px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Keep the watermark
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
