"use client";

import { useState } from "react";
import { clsx } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

/**
 * Tap-to-select chip picker over the candidate's own saved options (recognition), plus a small
 * "add your own" field for anything not yet in the list (composition, as a fallback only). Used
 * by the Win Builder's "Tools?" and "For whom?" steps over UserProfile.tools/stakeholders, and
 * generic enough to reuse anywhere else a pick-from-your-own-list chip UI is needed.
 * Large tap targets throughout (min 44px) - this has to work comfortably on a phone.
 */
export function ChipPicker({
  options,
  selected,
  onToggle,
  onAddNew,
  addPlaceholder = "Add your own",
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onAddNew: (value: string) => void;
  addPlaceholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    onAddNew(value);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-3">
      {options.length > 0 && (
        <StaggerList className="flex flex-wrap gap-2">
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <StaggerItem key={option}>
                <button
                  type="button"
                  onClick={() => onToggle(option)}
                  aria-pressed={isSelected}
                  className={clsx(
                    "min-h-11 rounded-pill border px-4 py-2 text-sm font-medium transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected
                      ? "border-accent bg-accent text-on-accent"
                      : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                  )}
                >
                  {option}
                </button>
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          placeholder={addPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitDraft();
            }
          }}
          className="min-h-11 flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <Button type="button" variant="outline" size="md" onClick={commitDraft} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
    </div>
  );
}
