"use client";

import { useId, useLayoutEffect, useState, type CSSProperties, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { clsx } from "@/lib/utils";

export interface Suggestion {
  value: string;
  /** Muted text beside the value, e.g. a postcode. */
  detail?: string;
}

/**
 * The dropdown half of a type-ahead field: keyboard navigation, ARIA combobox wiring and the list
 * itself. The caller owns the input and its text, computes `items` from it, and renders `list`
 * inside a `relative` wrapper around the input (or passes `anchor` - see below).
 *
 * Nothing is highlighted until the arrow keys are used, so Enter still means "what I typed" -
 * a custom value is never silently swapped for the top suggestion.
 */
export function useSuggestions(
  items: readonly Suggestion[],
  onPick: (value: string) => void,
  {
    footer,
    anchor,
  }: {
    /** Small print under the options, e.g. a data credit. */
    footer?: ReactNode;
    /** Pin the list to the viewport under this element instead of absolutely inside the wrapper -
     * for inputs inside a scrolling/overflow-clipped container, which would cut the list off. */
    anchor?: RefObject<HTMLElement | null>;
  } = {}
) {
  const listId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const showList = isOpen && items.length > 0;

  useLayoutEffect(() => {
    const el = anchor?.current;
    if (!showList || !el) return;
    const update = () => setAnchorRect(el.getBoundingClientRect());
    update();
    // Capture phase so a scrolling ancestor (not just the window) also moves the list.
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [showList, anchor]);

  function pick(value: string) {
    onPick(value);
    setActiveIndex(-1);
    // Typing again reopens it (onType).
    setIsOpen(false);
  }

  /** Handles the keys the list owns. Returns true when it did, so the caller skips its own handling. */
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): boolean {
    if (!showList) {
      // Reopen after Escape without having to edit the text.
      if (event.key === "ArrowDown" && !isOpen && items.length > 0) {
        event.preventDefault();
        setIsOpen(true);
        return true;
      }
      return false;
    }
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
    "aria-activedescendant": showList && activeIndex >= 0 && activeIndex < items.length ? `${listId}-${activeIndex}` : undefined,
    autoComplete: "off",
  };

  let pinnedStyle: CSSProperties | undefined;
  if (anchor && anchorRect) {
    const width = Math.max(anchorRect.width, 256);
    pinnedStyle = {
      top: anchorRect.bottom + 4,
      left: Math.max(8, Math.min(anchorRect.left, window.innerWidth - width - 8)),
      width,
    };
  }
  const pinned = pinnedStyle !== undefined;

  const panel = showList && (!anchor || pinned) ? (
    <div
      style={pinnedStyle}
      className={clsx(
        "z-30 overflow-hidden rounded border border-border bg-surface shadow-pop",
        pinned ? "fixed" : "absolute left-0 right-0 top-full mt-1"
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
  // Portalled when pinned, so a transformed ancestor can't become the containing block.
  const list = panel && pinned ? createPortal(panel, document.body) : panel;

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
