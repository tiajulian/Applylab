"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
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

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        handleDismiss();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, resumeId]);

  function handleDismiss() {
    // Save to sessionStorage so downsell modal doesn't nag repeatedly in this session
    try {
      sessionStorage.setItem(`downsell_dismissed_${resumeId}`, "true");
    } catch {
      // Ignore storage quota/permission issues
    }
    trackFunnelEvent("downsell_dismissed", { resumeId, price: 2.99 });
    onClose();
  }

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
          aria-labelledby="downsell-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/60 backdrop-blur-xs"
            onClick={handleDismiss}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-2xl border-2 border-accent/40 bg-surface p-6 sm:p-8 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute right-4 top-4 rounded-full p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header Badge & Headline */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-attention/30 bg-attention-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-attention">
                BEFORE YOU GO · SPECIAL ONE-TIME OFFER
              </span>
              <h2 id="downsell-modal-title" className="mt-3 font-display text-h3 font-bold text-ink leading-snug">
                One-time unlock for THIS resume only
              </h2>
              <p className="mt-1.5 text-xs text-ink-secondary">
                {resumeTitle
                  ? `Need just "${resumeTitle}" for an urgent application?`
                  : "Need just this resume for an urgent application?"}
              </p>
            </div>

            {/* Price Box with explicit no-subscription copy */}
            <div className="mt-4 rounded-xl border border-accent/20 bg-accent-soft/40 p-4 text-center">
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="font-display text-3xl font-extrabold text-ink">$2.99</span>
                <span className="text-xs font-bold text-accent">AUD</span>
                <span className="ml-1 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-ink shadow-xs">
                  Single payment
                </span>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-ink-secondary">
                ✓ No subscription · ✓ No auto-renew · ✓ Single payment · ✓ Keep it forever
              </p>
            </div>

            {/* What's included */}
            <div className="mt-4 space-y-2 text-xs text-ink">
              <div className="flex items-start gap-2">
                <span className="font-bold text-success shrink-0">✓</span>
                <span>Immediate clean, watermark-free <strong>PDF download</strong></span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-success shrink-0">✓</span>
                <span>Editable <strong>Word (.docx)</strong> export for ATS submissions</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-success shrink-0">✓</span>
                <span>Permanent lifetime access &amp; unlimited re-downloads for this resume</span>
              </div>
            </div>

            {error && <p className="mt-3 text-center text-xs font-semibold text-critical">{error}</p>}

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                type="button"
                className="w-full justify-center bg-accent hover:bg-accent-hover text-on-accent font-bold py-3.5 text-sm shadow-md"
                onClick={handleUnlock}
                isLoading={isLoading}
              >
                Fix and clean-export this resume — $2.99
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-center text-xs text-ink-muted hover:text-ink"
                onClick={handleDismiss}
              >
                No thanks, maybe later
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
