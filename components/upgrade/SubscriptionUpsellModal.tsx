"use client";

import { useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PASS_THROUGH_ON_EXIT } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { CheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { ProCheckoutButtons } from "@/components/upgrade/ProCheckoutButtons";
import { PLANS } from "@/lib/marketing/plans";

interface SubscriptionUpsellModalProps {
  isOpen: boolean;
  /** Where a logged-out user returns after signing in; defaults to the resume's own page. */
  returnPath?: string;
  resumeId?: string;
  onClose: () => void;
}

/**
 * Shown when a free user tries to download. Same shell as LimitReachedModal; the feature list is
 * PLANS.pro.features so it can't promise anything the pricing page doesn't.
 */
export function SubscriptionUpsellModal({
  isOpen,
  resumeId,
  returnPath = `/resume/${resumeId}`,
  onClose,
}: SubscriptionUpsellModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Records the opener before ProCheckoutButtons' (passive) focus effect, and restores it on close.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div exit={PASS_THROUGH_ON_EXIT}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upsell-modal-title"
          aria-describedby="upsell-modal-message"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-ink/50 backdrop-blur-xs"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Outside the scroll area so it can't scroll out of reach on short screens. */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-auto sm:w-auto sm:p-1"
              aria-label="Close modal"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="text-center">
                <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                  ApplyLab Pro
                </span>
                <h2 id="upsell-modal-title" className="mx-auto mt-3 max-w-[22rem] text-balance font-display text-h3 font-bold text-ink">
                  Go Pro to download
                </h2>
                <p id="upsell-modal-message" className="mx-auto mt-2 max-w-[22rem] text-pretty text-sm text-ink-secondary">
                  Get clean PDF and Word files, plus everything else you need for this job search.
                </p>
              </div>

              <ul className="mt-5 space-y-2.5 text-sm text-ink">
                {PLANS.pro.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-6">
                <ProCheckoutButtons returnPath={returnPath} autoFocusQuarter={isOpen} />
              </div>

              <div className="mt-5 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-center text-sm text-ink-secondary hover:text-ink"
                  onClick={onClose}
                >
                  Maybe later
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
