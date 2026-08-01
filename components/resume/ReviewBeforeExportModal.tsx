"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { FactCheckFlag } from "@/types";

export function ReviewBeforeExportModal({
  flags,
  onConfirm,
  onCancel,
}: {
  flags: FactCheckFlag[];
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      />
      <motion.div
        className="relative w-full max-w-lg rounded bg-surface p-6 shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <h2 className="font-display text-h3 text-ink">Review before you export</h2>

        {flags.length > 0 ? (
          <>
            <p className="mt-1 text-sm text-ink-secondary">
              We flagged {flags.length} {flags.length === 1 ? "detail" : "details"} in this resume that
              don&apos;t clearly trace back to what you told us, so double-check these are accurate
              before you send this out.
            </p>
            <ul className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto">
              {flags.map((flag, i) => (
                <li key={i} className="rounded border border-attention/30 bg-attention-soft p-3 text-sm">
                  <p className="font-medium text-attention">{flag.location}</p>
                  <p className="mt-0.5 text-attention">{flag.message}</p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink-secondary">
            No specific facts were flagged, but please give the resume a final read before exporting,
            since you&apos;re the one who has to stand behind it in an interview.
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={onConfirm}>
            I&apos;ve reviewed it, export
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
