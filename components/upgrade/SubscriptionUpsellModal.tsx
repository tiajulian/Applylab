"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

interface SubscriptionUpsellModalProps {
  isOpen: boolean;
  resumeId: string;
  onClose: () => void;
}

export function SubscriptionUpsellModal({
  isOpen,
  resumeId,
  onClose,
}: SubscriptionUpsellModalProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  async function handleUpgrade() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      });

      if (response.status === 401) {
        router.push(`/login?redirectedFrom=/resume/${resumeId}`);
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.url) {
        setError(data.error ?? "Failed to start checkout");
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
          aria-labelledby="upsell-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/50 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Icon */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Close modal"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Header Badge & Title */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                APPLYLAB PRO COPILOT
              </span>
              <h2 id="upsell-modal-title" className="mt-3 font-display text-h3 font-bold text-ink">
                Upgrade to Pro to Export
              </h2>
              <p className="mt-1.5 text-xs text-ink-secondary">
                Unlock clean PDF &amp; Word downloads, unlimited tailored applications, and AI interview prep.
              </p>
            </div>

            {/* Price Box */}
            <div className="mt-5 flex items-baseline justify-center gap-1.5 rounded-xl border border-border bg-paper-deep/60 p-3 text-center">
              <span className="font-display text-2xl font-bold text-ink">$19</span>
              <span className="text-xs font-semibold text-ink-secondary">AUD</span>
              <span className="text-xs text-ink-muted">/ month · Cancel anytime</span>
            </div>

            {/* Feature List */}
            <ul className="mt-5 space-y-2.5 text-xs text-ink">
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-success shrink-0">✓</span>
                <span><strong>Clean PDF &amp; Word (.docx)</strong> exports</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-success shrink-0">✓</span>
                <span><strong>Unlimited</strong> tailored resumes &amp; cover letters</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-success shrink-0">✓</span>
                <span><strong>SEEK &amp; LinkedIn</strong> 1-click job match analysis</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="font-bold text-success shrink-0">✓</span>
                <span><strong>AI STAR Interview Room</strong> role-specific simulator</span>
              </li>
            </ul>

            {error && <p className="mt-3 text-center text-xs font-semibold text-critical">{error}</p>}

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2.5">
              <Button
                type="button"
                className="w-full justify-center font-bold py-3 shadow-sm"
                onClick={handleUpgrade}
                isLoading={isLoading}
              >
                Upgrade to Pro ($19 AUD/mo) →
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-center text-xs text-ink-muted hover:text-ink"
                onClick={onClose}
              >
                Maybe later
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
