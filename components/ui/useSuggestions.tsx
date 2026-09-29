"use client";

import { useId, useState, type KeyboardEvent, type ReactNode } from "react";
import { clsx } from "@/lib/utils";

export interface Suggestion {
  value: string;
  /** Muted text beside the value, e.g. a postcode. */
  detail?: string;
}

/**
 * The dropdown half of a type-ahead field: keyboard navigation, ARIA combobox wiring and the list
 * itself. The caller owns the input and its text, computes `items` from it, and renders `list`
 * inside a `relative` wrapper around the input.
 *
 * Nothing is highlighted until the arrow keys are used, so Enter still means "what I typed" -
 * a custom value is never silently swapped for the top suggestion.
 */
export function useSuggestions(
  items: readonly Suggestion[],
  onPick: (value: string) => void,
  {
    footer,
    placement = "left-0 right-0",
  }: {
    /** Small print under the options, e.g. a data credit. */
    footer?: ReactNode;
    /** Horizontal position/width classes, replacing the default full input width - e.g.
     * "left-0 w-64" under a narrow input. */
    placement?: string;
  } = {}
) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const showList = isOpen && items.length > 0;

  function pick(value: string) {
    onPick(value);
    setActiveIndex(-1);
    // Typing again reopens it (onType).
    setIsOpen(false);
  }

  /** Handles the keys the list owns. Returns true when it did, so the caller skips its own handling. */
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): boolean {
    if (!showList) return false;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      // -1 is "nothing highlighted".
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => {
        const next = i + step;
        return next >= items.length ? -1 : next < -1 ? items.length - 1 : next;
      });
      return true;
    }
    if (event.key === "Escape") {
      // Close just the list, not a surrounding dialog.
      event.stopPropagation();
      setIsOpen(false);
      return true;
    }
    if (event.key === "Enter" && activeIndex >= 0 && activeIndex < items.length) {
      event.preventDefault();
      pick(items[activeIndex].value);
      return true;
    }
    return false;
  }

  const inputProps = {
    role: "combobox" as const,
    "aria-autocomplete": "list" as const,
    "aria-expanded": showList,
    "aria-controls": listId,
    "aria-activedescendant": showList && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined,
    autoComplete: "off",
  };

  const list = showList ? (
    <div
      className={clsx(
        "absolute top-full z-20 mt-1 overflow-hidden rounded border border-border bg-surface shadow-pop",
        placement
      )}
    >
      <ul id={listId} role="listbox" aria-label="Suggestions" className="max-h-60 overflow-y-auto py-1">
        {items.map((item, index) => (
          <li
            key={item.value}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // mousedown, not click: keeps focus in the input so its blur doesn't close the list first.
            onMouseDown={(event) => {
              event.preventDefault();
              pick(item.value);
            }}
            onMouseEnter={() => setActiveIndex(index)}
            className={clsx(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm text-ink",
              index === activeIndex && "bg-paper-deep text-accent"
            )}
          >
            <span>{item.value}</span>
            {item.detail && <span className="text-xs text-ink-muted">{item.detail}</span>}
          </li>
        ))}
      </ul>
      {footer && <div className="border-t border-border px-3 py-1.5 text-xs text-ink-muted">{footer}</div>}
    </div>
  ) : null;

  return {
    inputProps,
    handleKeyDown,
    list,
    /** Call from the input's onChange: reopens the list and clears the highlight. */
    onType: () => {
      setIsOpen(true);
      setActiveIndex(-1);
    },
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
