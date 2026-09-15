"use client";

import { AnimatePresence, motion } from "framer-motion";
import { VersionHistoryPanel } from "@/components/resume/VersionHistoryPanel";
import type { Resume } from "@/types";

export function VersionHistorySlideOver({
  isOpen,
  resumeId,
  onClose,
  onRestore,
}: {
  isOpen: boolean;
  resumeId: string;
  onClose: () => void;
  onRestore: (resume: Resume) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-ink/60 backdrop-blur-xs"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative flex h-full w-full max-w-sm flex-col border-l border-border bg-surface shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="version-history-title"
          >
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 id="version-history-title" className="font-display text-h3 text-ink">
                Version history
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close version history"
                className="rounded-full p-1.5 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <VersionHistoryPanel resumeId={resumeId} open={isOpen} onRestore={onRestore} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
