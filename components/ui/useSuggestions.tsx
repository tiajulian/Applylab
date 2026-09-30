"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { clsx } from "@/lib/utils";

export interface Suggestion {
  value: string;
  /** Muted text beside the value, e.g. a postcode. */
  detail?: string;
}

const MIN_WIDTH = 256;
const MAX_HEIGHT = 240;
const GAP = 4;
const EDGE = 8;

interface Placement {
  style: CSSProperties;
  /** Height the list itself may use (the footer, if any, sits below it). */
  listMaxHeight: number;
}

/**
 * Where the list goes for an input at `rect`: below it, or above when there's clearly more room
 * there. Measured against the visual viewport, so a phone's on-screen keyboard (which shrinks
 * only that, not window.innerHeight) counts as no room.
 */
function placeUnder(rect: DOMRect): Placement | null {
  const { innerWidth, innerHeight, visualViewport: vv } = window;
  const viewTop = vv ? vv.offsetTop : 0;
  const viewBottom = vv ? vv.offsetTop + vv.height : innerHeight;
  // Scrolled out of view - don't leave a list floating over unrelated content.
  if (rect.bottom < viewTop || rect.top > viewBottom) return null;
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), innerWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(rect.left, innerWidth - width - EDGE));
  const below = viewBottom - rect.bottom - GAP - EDGE;
  const above = rect.top - viewTop - GAP - EDGE;
  const flip = below < 160 && above > below;
  const room = Math.max(96, Math.min(MAX_HEIGHT, flip ? above : below));
  return {
    style: flip ? { left, width, bottom: innerHeight - rect.top + GAP } : { left, width, top: rect.bottom + GAP },
    listMaxHeight: room,
  };
}

const sameRect = (a: DOMRect | null, b: DOMRect) =>
  a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.bottom === b.bottom;

/**
 * The dropdown half of a type-ahead field: keyboard navigation, ARIA combobox wiring and the list
 * itself. The caller owns the input and its text, computes `items` from it, passes `anchor` as the
 * input's ref and renders `list` anywhere.
 *
 * The list is portalled to <body> and positioned against the viewport under the input, so a
 * scrolling modal or an overflow-clipped row can't cut it off, and it sits right under the input
 * even when an error message follows it.
 *
 * Nothing is highlighted until the arrow keys are used (hover only styles an option), so Enter
 * still means "what I typed" - a custom value is never silently swapped for a suggestion.
 */
export function useSuggestions(
  items: readonly Suggestion[],
  onPick: (value: string) => void,
  {
    footer,
  }: {
    /** Small print under the options, e.g. a data credit. */
    footer?: ReactNode;
  } = {}
) {
  const listId = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const anchor = useCallback((node: HTMLElement | null) => {
    anchorRef.current = node;
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const showList = isOpen && items.length > 0;

  useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!showList || !el) return;
    // Only re-render when the input actually moved - scroll events (including ones inside the
    // list) fire many times a second.
    const update = () => {
      const rect = el.getBoundingClientRect();
      setAnchorRect((prev) => (sameRect(prev, rect) ? prev : rect));
    };
    update();
    // Capture phase so a scrolling ancestor (not just the window) also moves the list; the visual
    // viewport resizes when a phone keyboard opens, which fires no window resize on iOS.
    const vv = window.visualViewport;
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [showList]);

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
      // Close just the list, not a surrounding dialog. Dialogs listen on document/window, and React
      // itself listens on document (registered first), so stop the rest of that node's listeners too.
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
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

  const placement = showList && anchorRect ? placeUnder(anchorRect) : null;
  const list = placement
    ? createPortal(
        <div
          style={placement.style}
          // Anywhere in the panel (options, padding, scrollbar, footer): keep focus in the input,
          // so its blur doesn't close the list before a pick or a scroll.
          onMouseDown={(event) => event.preventDefault()}
          className="fixed z-[60] overflow-hidden rounded border border-border bg-surface shadow-pop"
        >
          <ul
            id={listId}
            role="listbox"
            aria-label="Suggestions"
            style={{ maxHeight: placement.listMaxHeight }}
            className="overflow-y-auto py-1"
          >
            {items.map((item, index) => (
              <li
                key={item.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // mousedown, not click: picks before anything else can move focus.
                onMouseDown={() => pick(item.value)}
                className={clsx(
                  "flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm text-ink hover:bg-paper-deep",
                  index === activeIndex && "bg-paper-deep text-accent"
                )}
              >
                <span>{item.value}</span>
                {item.detail && <span className="text-xs text-ink-muted">{item.detail}</span>}
              </li>
            ))}
          </ul>
          {footer && <div className="border-t border-border px-3 py-1.5 text-xs text-ink-muted">{footer}</div>}
        </div>,
        document.body
      )
    : null;

  return {
    inputProps,
    /** Ref for the input the list should sit under. */
    anchor,
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
