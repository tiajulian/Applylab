"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { ChipPicker } from "@/components/profile/ChipPicker";
import { TOOL_CATALOG } from "@/lib/wins/toolCatalog";
import { addPick, pickOptions, togglePick } from "@/lib/profile/pickOptions";
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

export type LinePickResult = Record<string, { tools: string[]; stakeholders: string[] }>;

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
  const [picks, setPicks] = useState<LinePickResult>(() =>
    Object.fromEntries(lines.map((line) => [line.key, { tools: line.tools, stakeholders: line.stakeholders }]))
  );

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

  function update(key: string, field: "tools" | "stakeholders", change: (list: string[]) => string[]) {
    setPicks((prev) => ({ ...prev, [key]: { ...prev[key], [field]: change(prev[key][field]) } }));
  }

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
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-y-auto rounded-lg bg-surface p-6 shadow-pop"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-pill text-ink-muted transition-colors duration-fast ease-editorial hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-8 sm:w-8"
          onClick={onClose}
        >
          <XIcon className="h-4 w-4" />
        </button>

        <div className="flex flex-col gap-4">
          <div className="pr-10">
            <h2 id="line-picks-title" className="font-display text-h3 text-ink">
              Add tools or teams? <span className="text-ink-muted">(optional)</span>
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              Tap only what you really used or worked with. They&apos;ll be worked into the new wording.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {lines.map((line) => {
              const current = picks[line.key];
              const toolOptions = pickOptions(line.suggestedTools, profileTools, current.tools);
              const stakeholderOptions = pickOptions(line.suggestedStakeholders, profileStakeholders, current.stakeholders);
              return (
                <div key={line.key} className="flex flex-col gap-3 rounded border border-border bg-paper-deep/30 p-3">
                  <p className="text-sm text-ink">{line.text}</p>
                  {toolOptions.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-ink-secondary">Tools used</p>
                      <ChipPicker
                        options={toolOptions}
                        selected={current.tools}
                        onToggle={(value) => update(line.key, "tools", (list) => togglePick(list, value))}
                        onAddNew={(value) => update(line.key, "tools", (list) => addPick(list, value))}
                        addPlaceholder="Other, e.g. Salesforce"
                        ariaLabel="Add another tool or system"
                        suggestions={TOOL_CATALOG}
                        compactAdd
                      />
                    </div>
                  )}
                  {stakeholderOptions.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-ink-secondary">Who was it for?</p>
                      <ChipPicker
                        options={stakeholderOptions}
                        selected={current.stakeholders}
                        onToggle={(value) => update(line.key, "stakeholders", (list) => togglePick(list, value))}
                        onAddNew={(value) => update(line.key, "stakeholders", (list) => addPick(list, value))}
                        addPlaceholder="Other, e.g. Head of Sales"
                        ariaLabel="Add who else it was for"
                        suggestions={profileStakeholders}
                        compactAdd
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" size="md" onClick={onSkip}>
              Skip
            </Button>
            <Button type="button" size="md" onClick={() => onImprove(picks)}>
              Improve wording
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
