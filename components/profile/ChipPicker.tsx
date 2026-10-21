"use client";

import { useCallback, useState } from "react";
import { clsx } from "@/lib/utils";
import { suggestionsFromList } from "@/lib/text/fuzzyMatch";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";
import { CheckIcon } from "@/components/ui/icons/LucideIcons";
import { useSuggestions } from "@/components/ui/useSuggestions";

// Everything that differs between the two chip sizes. "sm" is for dense lists of pickers: smaller
// from the sm breakpoint up (a full 44px tap target on phones either way), with a soft tinted pick
// and a tick so several selections stay easy to scan.
const SIZE_STYLES = {
  md: {
    chip: "min-h-11 px-4 py-2 text-sm",
    gap: "gap-2",
    selected: "border-accent bg-accent text-on-accent",
    selectedTick: false,
    input: "",
    addButton: "",
  },
  sm: {
    chip: "min-h-11 px-3.5 py-1.5 text-sm sm:min-h-8 sm:px-3 sm:py-1 sm:text-[13px]",
    gap: "gap-1.5",
    selected: "border-accent/60 bg-accent-soft text-accent",
    selectedTick: true,
    input: "sm:min-h-9 sm:py-1.5",
    addButton: "min-h-11 sm:min-h-0",
  },
} as const;

/**
 * Tap-to-select chip picker over the candidate's own saved options (recognition), plus a small
 * "add your own" field for anything not yet in the list (composition, as a fallback only). Used
 * by the Win Builder's "Tools?" and "For whom?" steps over UserProfile.tools/stakeholders, and
 * generic enough to reuse anywhere else a pick-from-your-own-list chip UI is needed.
 * Large tap targets throughout (min 44px) - this has to work comfortably on a phone.
 * Pass `suggestions` (e.g. TOOL_CATALOG) to get a typo-tolerant dropdown while typing.
 */
export function ChipPicker({
  options,
  selected,
  onToggle,
  onAddNew,
  addPlaceholder = "Add your own",
  ariaLabel = addPlaceholder,
  emptyHint,
  suggestions,
  compactAdd = false,
  size = "md",
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
  onAddNew: (value: string) => void;
  addPlaceholder?: string;
  /** The input's accessible name - defaults to `addPlaceholder` (fine when that text itself
   * describes the action, e.g. "Add who it was for (e.g. 50+ stakeholders)"), but must be passed
   * explicitly whenever `addPlaceholder` is trimmed down to an example-only string (e.g. "e.g.
   * POS system, Excel"), since a screen reader announces the accessible name, not the visible
   * placeholder text, and an examples-only string alone doesn't say what the field is for. */
  ariaLabel?: string;
  /** Shown only while `options` is empty (nothing to tap yet) - explains that typing one here
   * grows the list for next time, so a blank picker reads as "type your first one" rather than
   * "broken/nothing to pick". */
  emptyHint?: string;
  /** Known values to suggest as the candidate types (on top of their own `options`), so they can
   * pick "Snowflake" after typing "sno" - or "snowflk" - instead of spelling it out. */
  suggestions?: readonly string[];
  /** Tuck the "add your own" field behind a "+ Other" chip until tapped - for screens showing
   * several pickers at once, where a full input under each would crowd out the chips. */
  compactAdd?: boolean;
  /** "sm" for dense lists of pickers: smaller chips from the sm breakpoint up (still a full 44px tap
   * target on phones), and a tick on selected chips so picks are easy to scan. */
  size?: "md" | "sm";
}) {
  const [draft, setDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const showInput = !compactAdd || addOpen || options.length === 0;
  const sz = SIZE_STYLES[size];

  const suggest = useCallback(
    (query: string) => (suggestions ? suggestionsFromList(query, [...options, ...suggestions], selected) : []),
    [options, suggestions, selected]
  );
  const dropdown = useSuggestions({ query: draft, suggest, onPick: choose });

  function choose(value: string) {
    const saved = options.find((option) => option.toLowerCase() === value.toLowerCase());
    if (saved) {
      if (!selected.includes(saved)) onToggle(saved);
    } else {
      onAddNew(value);
    }
    setDraft("");
    setAddOpen(false);
  }

  function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    // Typed a known name in different casing ("excel") - keep the proper spelling.
    const lower = value.toLowerCase();
    const known = [...options, ...(suggestions ?? [])].find((option) => option.toLowerCase() === lower);
    choose(known ?? value);
  }

  return (
    <div className="flex flex-col gap-3">
      {options.length === 0 && emptyHint && <p className="text-xs text-ink-muted">{emptyHint}</p>}
      {options.length > 0 && (
        <StaggerList className={clsx("flex flex-wrap", sz.gap)}>
          {options.map((option) => {
            const isSelected = selected.includes(option);
            return (
              <StaggerItem key={option}>
                <button
                  type="button"
                  onClick={() => onToggle(option)}
                  aria-pressed={isSelected}
                  className={clsx(
                    sz.chip,
                    "rounded-pill border font-medium transition-colors duration-fast ease-editorial focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isSelected ? sz.selected : "border-border bg-surface text-ink-secondary hover:border-accent/40 hover:text-accent"
                  )}
                >
                  {sz.selectedTick && isSelected && <CheckIcon className="-ml-0.5 mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />}
                  {option}
                </button>
              </StaggerItem>
            );
          })}
          {!showInput && (
            <StaggerItem key="__other">
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className={clsx(
                  sz.chip,
                  "rounded-pill border border-dashed border-border bg-surface font-medium text-ink-secondary transition-colors duration-fast ease-editorial hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                )}
              >
                + Other
              </button>
            </StaggerItem>
          )}
        </StaggerList>
      )}
      {showInput && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            autoFocus={compactAdd && addOpen}
            {...(suggestions ? dropdown.inputProps : {})}
            aria-label={ariaLabel}
            value={draft}
            placeholder={addPlaceholder}
            onChange={(e) => {
              setDraft(e.target.value);
              dropdown.open();
            }}
            onFocus={dropdown.open}
            onBlur={dropdown.close}
            onKeyDown={(e) => {
              if (dropdown.handleKeyDown(e)) return;
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
              }
            }}
            className={clsx(
              "min-h-11 flex-1 rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring",
              sz.input
            )}
          />
          {dropdown.list}
          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={commitDraft}
            disabled={!draft.trim()}
            // A small button still keeps a full 44px tap target on phones.
            className={clsx("sm:shrink-0", sz.addButton)}
          >
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
