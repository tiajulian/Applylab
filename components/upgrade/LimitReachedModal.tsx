"use client";

import { useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PASS_THROUGH_ON_EXIT } from "@/lib/motion";
import { Button } from "@/components/ui/Button";
import { XIcon } from "@/components/ui/icons/LucideIcons";
import { ProCheckoutButtons } from "@/components/upgrade/ProCheckoutButtons";

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** e.g. "You've used your free resumes" - names the specific thing they hit, not a generic
   * "limit reached" (spec §10/§15: say clearly what they hit). */
  title: string;
  /** e.g. "You've used both of your free resume generations." - the honest, feature-specific
   * fact. Never mention a reset date here unless the limit genuinely resets (most of today's free
   * limits are lifetime-per-account or per-resume, not time-windowed). */
  message: string;
}

/**
 * Generic "you hit a free-tier limit" popup, reused across every feature that has its own limit
 * (resume generations, AI assist, content score, ...) instead of each one growing its own inline
 * banner - see SkillsBridgeReview.tsx and BulletEditor.tsx, which used to render this inline.
 * Modeled on SubscriptionUpsellModal.tsx's overlay/panel structure (this app has no generic
 * Modal/Dialog primitive - see that file's own comment). Offers both Pro intervals as direct
 * checkout buttons (pricing brief 9.5), the same pair as the upsell modal.
 */
export function LimitReachedModal({ isOpen, onClose, title, message }: LimitReachedModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus moves into the dialog (ProCheckoutButtons focuses the primary button); hand it back to
  // whatever opened the modal when it closes, so keyboard users don't land at the top of the page.
  // A layout effect, so it records the opener before that child's (passive) focus effect runs.
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
          aria-labelledby="limit-reached-modal-title"
          aria-describedby="limit-reached-modal-message"
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
            {/* Close Button - a sibling of the scrollable content below, not a child of it, so it
                can't scroll out of reach if a long title/message ever overflows 90vh. */}
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
                <span className="inline-flex items-center gap-1.5 rounded-full border border-attention/30 bg-attention-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-attention">
                  FREE PLAN LIMIT
                </span>
                <h2 id="limit-reached-modal-title" className="mx-auto mt-3 max-w-[22rem] text-balance font-display text-h3 font-bold text-ink">
                  {title}
                </h2>
                <p id="limit-reached-modal-message" className="mx-auto mt-2 max-w-[22rem] text-pretty text-sm text-ink-secondary">
                  {message}
                </p>
              </div>

              <div className="mt-6">
                <ProCheckoutButtons autoFocusQuarter={isOpen} />
              </div>

              {/* Reassurance sits with the dismiss action - spec §10/§15: the non-AI parts of the
                 product are unlimited and free forever, so "Maybe later" reads as a real option,
                 not "the product stopped working". */}
              <div className="mt-5 border-t border-border pt-4 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-center text-sm text-ink-secondary hover:text-ink"
                  onClick={onClose}
                >
                  Maybe later
                </Button>
                <p className="mt-1 text-xs text-ink-muted">
                  You can still edit, save, and download everything manually, free forever.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
