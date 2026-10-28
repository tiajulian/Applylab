"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { XIcon } from "@/components/ui/icons/LucideIcons";
import { clsx } from "@/lib/utils";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const EASE = [0.2, 0.8, 0.2, 1] as const;

/**
 * The frame every editor pop-up shares (Add role/project/qualification/referee, Suggest tasks), so
 * they all open, close and behave the same way:
 * - a bottom sheet on phones (sized to its content, title and buttons pinned, the middle scrolls);
 *   from sm up a centred dialog, or with placement="side" a panel down the right from lg up, which
 *   keeps the resume in view while browsing ideas for it;
 * - Esc, the backdrop, ✕ and the footer's Cancel all go through one close path, which asks
 *   "Close without adding?" once something has been entered;
 * - focus stays inside while open and goes back to the button that opened it afterwards.
 *
 * Portaled to body: the canvas is CSS-transformed for zoom, which would trap `position: fixed`.
 * React still bubbles events up the component tree, so data-selection-keep and stopPropagation keep
 * clicks in here from selecting or deselecting canvas zones behind it; data-canvas-sheet hides the
 * canvas's floating toolbars meanwhile (globals.css).
 */
export function CanvasSheet({
  title,
  subtitle,
  placement = "center",
  isDirty,
  onDismiss,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  placement?: "center" | "side";
  /** Something's been entered that closing would lose. */
  isDirty: boolean;
  /** Closed without adding (after the confirm, when there was something to lose). */
  onDismiss: () => void;
  /** The action row. Gets the shared close path for its Cancel button. */
  footer: (requestClose: () => void) => ReactNode;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const titleId = useId();
  // Slides in from the side only where it actually sits at the side.
  const [slidesFromSide] = useState(
    () => placement === "side" && typeof window !== "undefined" && window.matchMedia?.("(min-width: 1024px)").matches
  );

  const requestClose = () => (isDirty ? setConfirmingDiscard(true) : onDismiss());
  const requestCloseRef = useRef(requestClose);
  requestCloseRef.current = requestClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    // Whatever's inside focuses its own first control; if nothing has by the next frame, the panel
    // takes focus so keyboard and screen-reader users start inside it.
    const frame = requestAnimationFrame(() => {
      if (!panelRef.current?.contains(document.activeElement)) panelRef.current?.focus();
    });
    function handleKeyDown(event: KeyboardEvent) {
      // Esc belongs to a dialog opened on top of this one (e.g. the account step), not to this.
      const active = document.activeElement;
      if (active && active !== document.body && !panelRef.current?.contains(active)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseRef.current();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Keeps Tab inside the pop-up while it's open.
  function trapFocus(event: React.KeyboardEvent) {
    if (event.key !== "Tab" || !panelRef.current) return;
    const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const isSide = placement === "side";

  return createPortal(
    <div
      className={clsx(
        "fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6",
        isSide && "lg:items-stretch lg:justify-end lg:p-0"
      )}
      data-selection-keep
      data-canvas-sheet
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        className={clsx("absolute inset-0", isSide ? "bg-ink/40 lg:bg-ink/20" : "bg-ink/40")}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: EASE }}
        onClick={requestClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={clsx(
          "relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-xl border border-border bg-surface shadow-pop focus:outline-none sm:max-w-lg sm:rounded-xl",
          isSide && "lg:h-full lg:max-h-none lg:max-w-[440px] lg:rounded-none lg:border-y-0 lg:border-r-0"
        )}
        initial={reduceMotion ? { opacity: 0 } : slidesFromSide ? { opacity: 0, x: 24 } : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-h3 text-ink">
              {title}
            </h2>
            {subtitle && <div className="mt-1 text-sm text-ink-secondary">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-mr-1.5 -mt-1 shrink-0 rounded-full p-1.5 text-ink-muted transition-colors hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Any click or change inside withdraws a pending "Close without adding?" - they're still
            working (a tab, a filter chip and a picked suggestion are clicks, not changes). */}
        <div
          className="flex min-h-0 flex-1 flex-col"
          onChangeCapture={() => setConfirmingDiscard(false)}
          onClickCapture={() => setConfirmingDiscard(false)}
        >
          {children}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-paper px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
          {confirmingDiscard ? (
            <>
              <p className="text-sm text-ink" role="alert">
                Close without adding?
              </p>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmingDiscard(false)}>
                  Keep editing
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={onDismiss}>
                  Discard
                </Button>
              </div>
            </>
          ) : (
            footer(requestClose)
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
}
