"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";

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
 * Modal/Dialog primitive - see that file's own comment), but links to /upgrade to compare plans
 * rather than jumping straight to checkout - a limit wall is a different moment than an explicit
 * "upgrade now" click.
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

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="limit-reached-modal-title"
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
            className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className="text-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-attention/30 bg-attention-soft px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-attention">
                FREE PLAN LIMIT
              </span>
              <h2 id="limit-reached-modal-title" className="mt-3 font-display text-h3 font-bold text-ink">
                {title}
              </h2>
              <p className="mt-1.5 text-xs text-ink-secondary">{message}</p>
            </div>

            {/* Reassurance line - spec §10/§15: the non-AI parts of the product are unlimited and
               free forever, so the wall reads as "you've used your AI allowance", not "the
               product stopped working". */}
            <p className="mt-5 rounded-xl border border-border bg-paper-deep/60 p-3 text-center text-xs text-ink-secondary">
              You can still edit, save, and download everything manually, free forever.
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <Button href="/upgrade" className="w-full justify-center font-bold py-3 shadow-sm">
                See Pro plans →
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
