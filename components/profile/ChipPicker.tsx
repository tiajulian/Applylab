"use client";

import { useId, useMemo, useState } from "react";
import { clsx } from "@/lib/utils";
import { suggestTools } from "@/lib/wins/toolCatalog";
import { Button } from "@/components/ui/Button";
import { StaggerList, StaggerItem } from "@/components/ui/StaggerList";

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
}) {
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();

  const matches = useMemo(
    () => (suggestions ? suggestTools(draft, [...options, ...suggestions], selected) : []),
    [draft, options, suggestions, selected]
  );
  const showList = isOpen && matches.length > 0;

  function choose(value: string) {
    const saved = options.find((option) => option.toLowerCase() === value.toLowerCase());
    if (saved) {
      if (!selected.includes(saved)) onToggle(saved);
    } else {
      onAddNew(value);
    }
    setDraft("");
    setActiveIndex(-1);
  }

  function commitDraft() {
    const value = draft.trim();
    if (!value) return;
    // Typed a known name in different casing ("excel") - keep the proper spelling.
    const exact = matches.find((match) => match.toLowerCase() === value.toLowerCase());
    choose(exact ?? value);
  }

  return (
    <div className="flex flex-col gap-3">
      {options.length === 0 && emptyHint && <p className="text-xs text-ink-muted">{emptyHint}</p>}
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
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            role={suggestions ? "combobox" : undefined}
            aria-autocomplete={suggestions ? "list" : undefined}
            aria-expanded={suggestions ? showList : undefined}
            aria-controls={suggestions ? listId : undefined}
            aria-activedescendant={showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            aria-label={ariaLabel}
            value={draft}
            placeholder={addPlaceholder}
            onChange={(e) => {
              setDraft(e.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (showList && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                e.preventDefault();
                // -1 is "no suggestion highlighted" (Enter adds exactly what was typed).
                const step = e.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((i) => {
                  const next = i + step;
                  return next >= matches.length ? -1 : next < -1 ? matches.length - 1 : next;
                });
              } else if (e.key === "Escape" && showList) {
                // Close just the list, not the surrounding dialog.
                e.stopPropagation();
                setIsOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                if (showList && activeIndex >= 0 && activeIndex < matches.length) choose(matches[activeIndex]);
                else commitDraft();
              }
            }}
            className="min-h-11 w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-[border-color,box-shadow] duration-fast ease-editorial focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {showList && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Suggestions"
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded border border-border bg-surface py-1 shadow-pop"
            >
              {matches.map((match, index) => (
                <li
                  key={match}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  // mousedown, not click: keeps focus in the input so blur doesn't close the list first.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(match);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={clsx(
                    "flex min-h-11 cursor-pointer items-center px-3 text-sm text-ink",
                    index === activeIndex && "bg-paper-deep text-accent"
                  )}
                >
                  {match}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Button type="button" variant="outline" size="md" onClick={commitDraft} disabled={!draft.trim()} className="sm:shrink-0">
          Add
        </Button>
      </div>
    </div>
  );
}
