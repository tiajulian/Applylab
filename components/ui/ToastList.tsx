"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { clsx } from "@/lib/utils";

export interface ToastItem {
  id: number;
  message: string;
  variant: "accent" | "success" | "attention" | "critical";
}

const VARIANT_STYLES: Record<ToastItem["variant"], string> = {
  accent: "bg-accent text-on-accent",
  success: "bg-success text-on-accent",
  attention: "bg-attention text-on-accent",
  critical: "bg-critical text-on-accent",
};

/** How long a toast stays on screen once it is shown. */
export const TOAST_DURATION_MS = 2600;

/**
 * Toasts are timed from when they are on screen, not from when they were raised: this list is
 * lazy-loaded on the first toast, and on a slow connection that load could otherwise outlast the
 * whole duration, so the first message would expire before anyone saw it.
 */
export function ToastList({ toasts, onExpire }: { toasts: ToastItem[]; onExpire: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onExpire={onExpire} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, onExpire }: { toast: ToastItem; onExpire: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onExpire(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onExpire]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      className={clsx(
        "pointer-events-auto rounded-pill px-4 py-2 text-sm font-medium shadow-pop",
        VARIANT_STYLES[toast.variant]
      )}
    >
      {toast.message}
    </motion.div>
  );
}
