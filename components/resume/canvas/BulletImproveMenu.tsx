"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { computePopoverStyle } from "@/lib/resume/popoverPosition";
import { suggestBulletChips } from "@/lib/resume/contentChecks";
import type { AssistAction } from "@/lib/anthropic/assistBullet";

const MENU_WIDTH = 260;

/** The canvas's floating AI-assist trigger for one bullet - replaces the sidebar BulletEditor's
 * always-open "Improve" dropdown with a portal-to-document.body menu, positioned via the same
 * viewport-clamped computePopoverStyle FactCheckFixPanel uses, since a plain absolutely-positioned
 * child can't escape the resume sheet's transformed/clipped ancestor (see ResumePreviewPane.tsx).
 * The chips offered are picked per bullet by suggestBulletChips (lib/resume/contentChecks.ts) -
 * not a fixed menu - so a bullet with no metric offers "Add a number" while a wordy one offers
 * "Tighten this up", etc. */
export function BulletImproveMenu({
  resumeId,
  bulletText,
  roleTitle,
  roleCompany,
  onAccept,
}: {
  resumeId: string;
  bulletText: string;
  roleTitle?: string;
  roleCompany?: string;
  onAccept: (value: string) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [options, setOptions] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen && !options) return;
    function handleClickOutside(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const menuEl = document.getElementById("bullet-improve-menu-portal");
        if (menuEl && menuEl.contains(e.target as Node)) return;
        setIsMenuOpen(false);
        setOptions(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, options]);

  function openMenu() {
    if (buttonRef.current) setAnchorRect(buttonRef.current.getBoundingClientRect());
    setIsMenuOpen((prev) => !prev);
  }

  async function runAssist(action: AssistAction) {
    if (!bulletText.trim()) return;
    setIsLoading(true);
    setError(null);
    setOptions(null);
    setLimitReached(false);

    try {
      const response = await fetch(`/api/resume/${resumeId}/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulletText, action, roleTitle, roleCompany }),
      });
      const data = await response.json().catch(() => ({}));
      setIsLoading(false);

      if (!response.ok) {
        if (response.status === 403) {
          setLimitReached(true);
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setOptions(data.options ?? []);
    } catch {
      setIsLoading(false);
      setError("Request timed out. Please try again.");
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Improve this bullet with AI"
        onClick={openMenu}
        style={{ cursor: "pointer", color: "var(--color-accent, #ca5933)" }}
      >
        <SparklesIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2} />
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {(isMenuOpen || options) && anchorRect && (
              <motion.div
                id="bullet-improve-menu-portal"
                // This menu is portaled out of the toolbar, so without this the editor's
                // click-outside-to-deselect treats a chip click as "outside", unmounts the toolbar
                // (and this component with it) mid-request, and the suggestions never appear.
                data-selection-keep
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12, ease: [0.2, 0.8, 0.2, 1] }}
                style={computePopoverStyle(anchorRect, MENU_WIDTH)}
                className="z-50 rounded-lg border border-border bg-surface p-2 shadow-pop"
                role="menu"
              >
                {!options ? (
                  <div className="flex flex-wrap gap-1.5 p-0.5">
                    {suggestBulletChips(bulletText).map((chip) => (
                      <button
                        key={chip.action}
                        type="button"
                        disabled={isLoading}
                        onClick={() => runAssist(chip.action)}
                        className="rounded-pill border border-border bg-paper px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? "Improving..." : chip.label}
                      </button>
                    ))}
                  </div>
                ) : options.length === 0 ? (
                  <p className="px-1 py-1 text-xs text-ink-muted">
                    No safe suggestions found - try another chip.
                  </p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold text-accent uppercase tracking-wider px-1">
                      AI Suggestions
                    </span>
                    {options.map((option, i) => (
                      <button
                        key={i}
                        type="button"
                        className="rounded bg-paper p-2 text-left text-xs leading-relaxed text-ink shadow-xs transition-colors hover:bg-paper-deep border border-border/60"
                        onClick={() => {
                          onAccept(option);
                          setOptions(null);
                          setIsMenuOpen(false);
                        }}
                      >
                        {option}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="self-start text-[11px] text-ink-muted hover:underline px-1"
                      onClick={() => setOptions(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
                {error && <p className="text-xs text-critical px-1 pt-1">{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      <LimitReachedModal
        isOpen={limitReached}
        onClose={() => setLimitReached(false)}
        title="You've used your free AI edits"
        message="You've used all your free AI-assist edits for this resume. Upgrade for unlimited edits on every resume."
      />
    </>
  );
}

