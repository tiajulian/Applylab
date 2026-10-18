"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PASS_THROUGH_ON_EXIT } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { CheckIcon, XIcon } from "@/components/ui/icons/LucideIcons";
import { ProCheckoutButtons } from "@/components/upgrade/ProCheckoutButtons";

interface SubscriptionUpsellModalProps {
  isOpen: boolean;
  /** Where a logged-out user returns after signing in; defaults to the resume's own page. */
  returnPath?: string;
  resumeId?: string;
  onClose: () => void;
}

export function SubscriptionUpsellModal({
  isOpen,
  resumeId,
  returnPath = `/resume/${resumeId}`,
  onClose,
}: SubscriptionUpsellModalProps) {
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div exit={PASS_THROUGH_ON_EXIT}
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
              <XIcon className="h-5 w-5" />
            </button>

            {/* Header Badge & Title */}
            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                APPLYLAB PRO
              </span>
              <h2 id="upsell-modal-title" className="mt-3 font-display text-h3 font-bold text-ink">
                Upgrade to Pro to Export
              </h2>
              <p className="mt-1.5 text-xs text-ink-secondary">
                Unlock clean PDF &amp; Word downloads, unlimited tailored applications, and AI interview prep.
              </p>
            </div>

            {/* Feature List */}
            <ul className="mt-5 space-y-2.5 text-xs text-ink">
              <li className="flex items-start gap-2.5">
                <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                <span><strong>Clean PDF &amp; Word (.docx)</strong> exports</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                <span><strong>Unlimited</strong> tailored resumes &amp; cover letters</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                <span><strong>SEEK &amp; LinkedIn</strong> 1-click job match analysis</span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckIcon className="h-4 w-4 shrink-0 text-success" />
                <span><strong>AI STAR Interview Room</strong> role-specific simulator</span>
              </li>
            </ul>

            {/* Actions */}
            <div className="mt-6 flex flex-col gap-2.5">
              <ProCheckoutButtons returnPath={returnPath} autoFocusQuarter={isOpen} />
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
