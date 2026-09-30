"use client";

import {
  useCallback,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { clsx } from "@/lib/utils";

export interface Suggestion {
  value: string;
  /** Muted text beside the value, e.g. a postcode. */
  detail?: string;
}

const MIN_WIDTH = 256;
const MAX_HEIGHT = 240;
const FOOTER_HEIGHT = 30;
const BORDER = 2;
const GAP = 4;
const EDGE = 8;

interface Placement {
  style: CSSProperties;
  /** Height the options may use - the panel's room minus its border and footer. */
  listMaxHeight: number;
}

/**
 * Where the panel goes for an input at `rect`: below it, or above when there's clearly more room
 * there. Measured against the visual viewport, so a phone's on-screen keyboard (which shrinks
 * only that, not window.innerHeight) counts as no room.
 */
function placeUnder(rect: DOMRect, hasFooter: boolean): Placement | null {
  // clientWidth/Height, not innerWidth/Height: those include the scrollbars, which the list
  // mustn't slide under.
  const { clientWidth: viewWidth, clientHeight: viewHeight } = document.documentElement;
  const vv = window.visualViewport;
  const viewTop = vv ? vv.offsetTop : 0;
  const viewBottom = vv ? vv.offsetTop + vv.height : viewHeight;
  // Scrolled out of view - don't leave a list floating over unrelated content.
  if (rect.bottom < viewTop || rect.top > viewBottom) return null;
  const width = Math.min(Math.max(rect.width, MIN_WIDTH), viewWidth - EDGE * 2);
  const left = Math.max(EDGE, Math.min(rect.left, viewWidth - width - EDGE));
  const below = viewBottom - rect.bottom - GAP - EDGE;
  const above = rect.top - viewTop - GAP - EDGE;
  const flip = below < 160 && above > below;
  const room = Math.min(MAX_HEIGHT, flip ? above : below);
  return {
    style: flip ? { left, width, bottom: viewHeight - rect.top + GAP } : { left, width, top: rect.bottom + GAP },
    listMaxHeight: Math.max(88, room - BORDER - (hasFooter ? FOOTER_HEIGHT : 0)),
  };
}

const sameRect = (a: DOMRect | null, b: DOMRect) =>
  a !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.bottom === b.bottom;

export interface UseSuggestionsOptions {
  /** The text to suggest for. */
  query: string;
  /** Suggestions for a query. Keep it stable (module-level or useCallback): it reruns when it changes. */
  suggest: (query: string) => readonly Suggestion[];
  onPick: (value: string) => void;
  /** Small print under the options, e.g. a data credit. */
  footer?: ReactNode;
  /** Whether ArrowDown opens a closed list (default). Off for a textarea, where it moves between lines. */
  arrowOpens?: boolean;
}

/**
 * The dropdown half of a type-ahead field: when to search, keyboard navigation, ARIA combobox
 * wiring and the list itself. The caller owns the input and its text: it spreads `inputProps`
 * (which include the ref the list is anchored to), calls `onType` from onChange and `close` from
 * onBlur, passes keys through `handleKeyDown` first, and renders `list` anywhere.
 *
 * - Suggestions are only computed while the list is open, so a pre-filled field never searches
 *   until someone types in it, and the search runs deferred so typing stays responsive.
 * - The list is portalled to <body> and pinned under the input, so a scrolling modal or an
 *   overflow-clipped row can't cut it off, and it sits right under the input even with an error
 *   message below it.
 * - Nothing is highlighted until the arrow keys are used (hover only styles an option), so Enter
 *   still means "what I typed" - a custom value is never silently swapped for a suggestion.
 */
export function useSuggestions({ query, suggest, onPick, footer, arrowOpens = true }: UseSuggestionsOptions) {
  const listId = useId();
  const anchorRef = useRef<HTMLElement | null>(null);
  const anchor = useCallback((node: HTMLElement | null) => {
    anchorRef.current = node;
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  // Both deferred: the keystroke that opens the list must not run a search (on the old text, too)
  // in the urgent render - only closing takes effect at once.
  const deferredQuery = useDeferredValue(query);
  const deferredOpen = useDeferredValue(isOpen);
  const items = useMemo(
    () => (isOpen && deferredOpen ? suggest(deferredQuery) : []),
    [isOpen, deferredOpen, deferredQuery, suggest]
  );
  const showList = isOpen && items.length > 0;
  // A new set of suggestions (the deferred search catching up, or data finishing loading) clears
  // the highlight - otherwise it would silently land on whatever is now at that position.
  const [highlightedItems, setHighlightedItems] = useState(items);
  if (highlightedItems !== items) {
    setHighlightedItems(items);
    setActiveIndex(-1);
  }

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Only re-render when the input actually moved.
    setAnchorRect((prev) => (sameRect(prev, rect) ? prev : rect));
  }, []);

  // Re-measure on every render while open: the input can move without any scroll or resize
  // (a hint appearing above it as you type), and a moved input must not leave the list behind.
  useLayoutEffect(() => {
    if (showList) measure();
  });

  useLayoutEffect(() => {
    if (!showList) return;
    // Capture phase so a scrolling ancestor (not just the window) also moves the list; the visual
    // viewport resizes when a phone keyboard opens, which fires no window resize on iOS.
    const vv = window.visualViewport;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
    };
  }, [showList, measure]);

  const placement = showList && anchorRect ? placeUnder(anchorRect, Boolean(footer)) : null;
  // Scrolled out of view counts as closed: Enter then means what was typed, not a hidden option.
  const visible = placement !== null;

  // Keep the highlighted option in view as the arrows move through a list taller than its box.
  useLayoutEffect(() => {
    if (visible && activeIndex >= 0) document.getElementById(`${listId}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [visible, activeIndex, listId]);

  const open = useCallback(() => {
    setIsOpen(true);
    setActiveIndex(-1);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
  }, []);

  function pick(value: string) {
    onPick(value);
    // Typing again reopens it (onType).
    close();
  }

  /** Handles the keys the list owns. Returns true when it did, so the caller skips its own handling. */
  function handleKeyDown(event: KeyboardEvent<HTMLElement>): boolean {
    // Mid-composition (Chinese, Japanese, Korean input), arrows and Enter belong to the IME. Reported
    // as handled so the caller doesn't treat the IME's confirming Enter as "add this".
    if (event.nativeEvent.isComposing || event.keyCode === 229) return true;
    if (!visible) {
      // ArrowDown shows suggestions for what's already there - after Escape, or on a filled field.
      if (arrowOpens && event.key === "ArrowDown" && !isOpen && query.trim()) {
        event.preventDefault();
        open();
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
      close();
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
    ref: anchor,
    role: "combobox" as const,
    "aria-autocomplete": "list" as const,
    "aria-expanded": visible,
    "aria-controls": listId,
    "aria-activedescendant": visible && activeIndex >= 0 && activeIndex < items.length ? `${listId}-${activeIndex}` : undefined,
    autoComplete: "off",
  };

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
                // mousedown, not click: picks before anything else can move focus. Left button only.
                onMouseDown={(event) => {
                  if (event.button === 0) pick(item.value);
                }}
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
          {footer && (
            <div style={{ height: FOOTER_HEIGHT }} className="flex items-center border-t border-border px-3 text-xs text-ink-muted">
              {footer}
            </div>
          )}
        </div>,
        document.body
      )
    : null;

  return {
    /** Spread onto the input: ARIA wiring plus the ref the list is anchored to. */
    inputProps,
    handleKeyDown,
    list,
    /** Call from the input's onChange: opens the list for the new text and clears the highlight. */
    onType: open,
    open,
    close,
  };
}
