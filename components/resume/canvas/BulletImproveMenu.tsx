"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { SparklesIcon } from "@/components/ui/icons/LucideIcons";
import { LimitReachedModal } from "@/components/upgrade/LimitReachedModal";
import { computePopoverStyle } from "@/lib/resume/popoverPosition";
import { suggestBulletChips } from "@/lib/resume/contentChecks";
import { stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import { BlockPinContext } from "@/components/templates/shared";
import type { AssistAction } from "@/lib/anthropic/assistBullet";
import { ImpactGuide } from "./ImpactGuide";
import { FREE_ASSIST_LIMIT_PER_RESUME } from "@/lib/limits";

const MENU_WIDTH = 260;

/** The canvas's floating AI-assist trigger for one bullet - replaces the sidebar BulletEditor's
 * always-open "Improve" dropdown with a portal-to-document.body menu, positioned via the same
 * viewport-clamped computePopoverStyle FactCheckFixPanel uses, since a plain absolutely-positioned
 * child can't escape the resume sheet's transformed/clipped ancestor (see ResumePreviewPane.tsx).
 * The chips offered are picked per bullet by suggestBulletChips (lib/resume/contentChecks.ts) -
 * not a fixed menu - so a bullet with no metric offers "Add a metric" while a wordy one offers
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
  // Free users' "Improve with AI" edits left on this resume; null for Pro or until loaded.
  const [assistsLeft, setAssistsLeft] = useState<number | null>(null);
  // Guide the candidate through their real outcome and optional measure before rewriting.
  const [isMetricStep, setIsMetricStep] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const requestId = useRef(0);
  // SSR-safe portal gate: `document` doesn't exist on the server, so checking
  // `typeof document !== "undefined"` directly in render disagrees between the server pass and the
  // client's first pass and fails hydration (see components/templates/shared.tsx for the same fix).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Keep the bullet's toolbar (which owns this component) mounted while the menu, a request or the
  // limit modal is up, even if focus moves into the portaled metric input or the pointer leaves.
  const pin = useContext(BlockPinContext);
  const isOpen = isMenuOpen || options !== null || limitReached;
  useEffect(() => {
    if (!isOpen || !pin) return;
    pin(true);
    return () => pin(false);
  }, [isOpen, pin]);

  useEffect(() => {
    if (isMetricStep || (!isMenuOpen && !options)) return;
    function handleClickOutside(e: MouseEvent) {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        const menuEl = document.getElementById("bullet-improve-menu-portal");
        if (menuEl && menuEl.contains(e.target as Node)) return;
        setIsMenuOpen(false);
        setOptions(null);
        setIsMetricStep(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen, options, isMetricStep]);

  // The allowance is per resume and shared by every bullet's menu, so it's refetched on each open
  // and after each edit rather than cached per menu.
  async function loadAssistsLeft() {
    try {
      const response = await fetch(`/api/user/free-usage?resumeId=${encodeURIComponent(resumeId)}`);
      const data = await response.json();
      setAssistsLeft(
        response.ok && data.plan === "free" && typeof data.assistUsed === "number"
          ? Math.max(0, FREE_ASSIST_LIMIT_PER_RESUME - data.assistUsed)
          : null
      );
    } catch {
      setAssistsLeft(null);
    }
  }

  function openMenu() {
    if (buttonRef.current) setAnchorRect(buttonRef.current.getBoundingClientRect());
    if (!isMenuOpen) void loadAssistsLeft();
    setIsMenuOpen((prev) => !prev);
  }

  // The AI (and suggestBulletChips' content-quality checks below) never see the bold/italic
  // markers (lib/resume/bulletMarkup.ts) - they have no reason to know "**"/"*" are meaningful
  // rather than stray prose to "clean up", and a rewrite it returns is plain text anyway (any
  // existing formatting on this bullet is lost if its suggestion is accepted - a known, accepted
  // v1 limitation of this feature, not something worth teaching the prompt to preserve).
  const plainBulletText = stripBulletMarkup(bulletText);

  async function runAssist(action: AssistAction, metricValue?: string, outcome?: string) {
    if (!plainBulletText.trim() || isLoading) return;
    const currentRequest = ++requestId.current;
    setIsLoading(true);
    setError(null);
    setOptions(null);
    setLimitReached(false);

    try {
      const response = await fetch(`/api/resume/${resumeId}/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bulletText: plainBulletText, action, roleTitle, roleCompany, metric: metricValue, outcome }),
      });
      const data = await response.json().catch(() => ({}));
      if (currentRequest !== requestId.current) return;
      setIsLoading(false);
      void loadAssistsLeft();

      if (!response.ok) {
        if (response.status === 403) {
          if (outcome !== undefined) {
            setError("You've used your free AI edits for this resume. Upgrade to Pro for more edits.");
            return;
          }
          setLimitReached(true);
          return;
        }
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setOptions(data.options ?? []);
    } catch {
      if (currentRequest !== requestId.current) return;
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
        style={{ cursor: "pointer", color: "var(--color-accent, var(--accent))" }}
      >
        <SparklesIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2} />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {!isMetricStep && (isMenuOpen || options) && anchorRect && (
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
                    {assistsLeft !== null && (
                      <p className="w-full px-0.5 text-[11px] text-ink-muted">
                        {assistsLeft} free AI edit{assistsLeft === 1 ? "" : "s"} left on this resume
                      </p>
                    )}
                    {suggestBulletChips(plainBulletText).map((chip) => (
                      <button
                        key={chip.action}
                        type="button"
                        disabled={isLoading}
                        onClick={() => (chip.action === "quantify" ? setIsMetricStep(true) : runAssist(chip.action))}
                        className="rounded-pill border border-border bg-paper px-2.5 py-1 text-xs font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? "Improving..." : chip.label}
                      </button>
                    ))}
                  </div>
                ) : options.length === 0 ? (
                  <div className="flex flex-col gap-1.5 px-1 py-1">
                    <p className="text-xs text-ink-muted">
                      No safe suggestions found{isMetricStep ? " with that figure" : ""}. Try again or pick another option.
                    </p>
                    <button
                      type="button"
                      className="self-start text-[11px] text-accent hover:underline"
                      onClick={() => setOptions(null)}
                    >
                      Try again
                    </button>
                  </div>
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
                          setIsMetricStep(false);
                        }}
                      >
                        {option}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="self-start text-[11px] text-ink-muted hover:underline px-1"
                      onClick={() => {
                        setOptions(null);
                        setIsMetricStep(false);
                      }}
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

      {mounted && isMetricStep && createPortal(
        <ImpactGuide bulletText={plainBulletText} assistsLeft={assistsLeft} loading={isLoading} options={options} error={error}
          onEditAnswers={() => setOptions(null)}
          onGenerate={(metric, outcome) => void runAssist("quantify", metric, outcome)}
          onAccept={(text) => { onAccept(text); setIsMetricStep(false); setIsMenuOpen(false); setOptions(null); buttonRef.current?.focus(); }}
          onClose={() => { requestId.current++; setIsLoading(false); setIsMetricStep(false); setIsMenuOpen(false); setOptions(null); setError(null); buttonRef.current?.focus(); }} />,
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

