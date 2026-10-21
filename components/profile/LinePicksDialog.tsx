"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { PickRows, type Picks } from "@/components/profile/PickRows";
import { sameText } from "@/lib/profile/pickOptions";
import { XIcon } from "@/components/ui/icons/LucideIcons";

export interface PickLine {
  key: string;
  text: string;
  suggestedTools: string[];
  suggestedStakeholders: string[];
  /** Picks the line already has (saved on the win or task) - shown selected. */
  tools: string[];
  stakeholders: string[];
}

export type LinePickResult = Record<string, Picks>;

/** How many of `values` aren't in `others` (case-insensitively). */
function countMissing(values: string[], others: string[]): number {
  return values.filter((value) => !others.some((other) => sameText(other, value))).length;
}

/**
 * A line's text, clipped to two rows. Only when it's actually clipped does it become a button that
 * opens the full text - a short line stays plain text, with nothing to tap and nothing announced.
 */
function LineText({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [isClipped, setIsClipped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const measure = () => setIsClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    // Re-checked when the line's box changes size (dialog width, wrapping) and once web fonts finish
    // loading, since a late font can push a line that fitted onto a third row.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(el);
    let active = true;
    document.fonts?.ready.then(() => active && measure());
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [text, expanded]);

  // Clamped on an inner span: line-clamp on a <button> itself isn't reliable in every browser.
  const content = (
    <span ref={ref} className={expanded ? "block" : "line-clamp-2"}>
      {text}
    </span>
  );
  const textClass = "text-left text-[13px] leading-relaxed text-ink-secondary";

  if (!isClipped && !expanded) return <p className={textClass}>{content}</p>;
  return (
    <button
      type="button"
      onClick={() => setExpanded((prev) => !prev)}
      aria-expanded={expanded}
      className={clsx(textClass, "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {content}
    </button>
  );
}

/**
 * The optional "Add tools or teams?" step before "Improve all the wording": only lines where a tool
 * or team would help are listed, each with only the rows that fit it. Improve wording passes the
 * picks to the rewrite; Skip rewrites without them; closing cancels.
 */
export function LinePicksDialog({
  lines,
  profileTools,
  profileStakeholders,
  onImprove,
  onSkip,
  onClose,
}: {
  lines: PickLine[];
  profileTools: string[];
  profileStakeholders: string[];
  onImprove: (picks: LinePickResult) => void;
  onSkip: () => void;
  onClose: () => void;
}) {
  const [picks, setPicks] = useState<LinePickResult>({});
  // Picks start as whatever the line already has; a line added after mount gets the same start.
  const picksFor = (line: PickLine): Picks => picks[line.key] ?? { tools: line.tools, stakeholders: line.stakeholders };

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Escape inside an "Other" field only closes its suggestions - never the whole dialog and its picks.
      const target = event.target as HTMLElement | null;
      if (event.key === "Escape" && !target?.closest("input, textarea")) onCloseRef.current();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Changes made here, against what each line already had: new picks, and saved ones unticked
  // (which Improve wording will drop from the line).
  let addedCount = 0;
  let removedCount = 0;
  for (const line of lines) {
    const now = picksFor(line);
    addedCount += countMissing(now.tools, line.tools) + countMissing(now.stakeholders, line.stakeholders);
    removedCount += countMissing(line.tools, now.tools) + countMissing(line.stakeholders, now.stakeholders);
  }
  const summary =
    [addedCount > 0 && `${addedCount} added`, removedCount > 0 && `${removedCount} removed`].filter(Boolean).join(" · ") ||
    "No changes";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <motion.div
        className="absolute inset-0 bg-ink/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-picks-title"
        aria-describedby="line-picks-description"
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-lg bg-surface shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        {/* Header and footer stay pinned while the list scrolls - except on short screens (a phone
            held sideways), where pinning them would leave the list a sliver, so it all scrolls. */}
        <div className="sticky top-0 z-10 border-b border-border bg-surface px-6 pb-4 pt-6 [@media(max-height:520px)]:static">
          <button
            type="button"
            aria-label="Close"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
            onClick={onClose}
          >
            <XIcon className="h-4 w-4" />
          </button>
          <h2 id="line-picks-title" className="pr-10 font-display text-h3 text-ink">
            Add tools or teams? <span className="font-normal text-ink-muted">(optional)</span>
          </h2>
          <p id="line-picks-description" className="mt-1 text-sm text-ink-secondary">
            {lines.length === 1 ? "1 line" : `${lines.length} lines`} could be more specific. Tap only what you
            really used; it goes into the new wording.
          </p>
        </div>

        <ul className="flex flex-col gap-2.5 px-6 py-4">
          {lines.map((line) => {
            const value = picksFor(line);
            const hasPicks = value.tools.length + value.stakeholders.length > 0;
            return (
              <li
                key={line.key}
                className={clsx(
                  "flex flex-col gap-3 rounded-lg border p-3.5 transition-colors duration-fast ease-editorial",
                  hasPicks ? "border-accent/40 bg-accent-soft/25" : "border-border bg-paper-deep/30"
                )}
              >
                {/* The line is context; the chips are the action - so the line reads quieter. */}
                <LineText text={line.text} />
                <PickRows
                  suggestedTools={line.suggestedTools}
                  suggestedStakeholders={line.suggestedStakeholders}
                  profileTools={profileTools}
                  profileStakeholders={profileStakeholders}
                  value={value}
                  onChange={(change) =>
                    setPicks((prev) => ({
                      ...prev,
                      [line.key]: change(prev[line.key] ?? { tools: line.tools, stakeholders: line.stakeholders }),
                    }))
                  }
                  compact
                />
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border bg-surface px-6 py-4 [@media(max-height:520px)]:static">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {summary}
          </p>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button type="button" variant="ghost" size="md" onClick={onSkip}>
              Skip
            </Button>
            <Button
              type="button"
              size="md"
              onClick={() => onImprove(Object.fromEntries(lines.map((line) => [line.key, picksFor(line)])))}
            >
              Improve wording
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
