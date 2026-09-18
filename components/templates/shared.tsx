"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CalendarIcon,
  GripVerticalIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
  TypeIcon,
} from "@/components/ui/icons/LucideIcons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { computePopoverStyle } from "@/lib/resume/popoverPosition";
import { checkSpelling, getSpellChecker, type Misspelling } from "@/lib/text/spellcheck";
import { factCheckTargetKey } from "@/types";

// How long to let typing settle before re-running the spell check - purely to avoid checking on
// every keystroke (each check is a synchronous, in-memory dictionary lookup once loaded, so this
// is about not thrashing the wavy-underline/glyph render mid-word, not cost or network).
const SPELLCHECK_DEBOUNCE_MS = 500;

const SPELLING_UNDERLINE_STYLE: CSSProperties = {
  textDecoration: "underline",
  textDecorationStyle: "wavy",
  textDecorationColor: "#b91c1c",
  textDecorationThickness: "1px",
  textUnderlineOffset: "3px",
};

const HIGHLIGHT_STYLE: Record<"flagged" | "active", CSSProperties> = {
  flagged: {
    textDecoration: "underline",
    textDecorationColor: "#d97706",
    textDecorationThickness: "1px",
    textUnderlineOffset: "1px",
    backgroundColor: "rgba(217,119,6,0.10)",
    borderRadius: "2px",
  },
  active: {
    textDecoration: "underline",
    textDecorationColor: "#b45309",
    textDecorationThickness: "2px",
    textUnderlineOffset: "1px",
    backgroundColor: "rgba(217,119,6,0.18)",
    borderRadius: "2px",
  },
};

// Module-level, not React state - incremented/decremented by MobileFieldSheet's own mount/unmount
// below. Only one field can have focus (hence only one sheet open) at a time, so a plain counter
// is enough to answer "is a sheet open right now" without needing to know which block it belongs
// to. See useBlockActive's blur handler for why this exists.
let openMobileSheetCount = 0;

/** Tracks whether a block should show its floating toolbar: true while the pointer is over it, OR
 * while focus is anywhere inside it (so keyboard/touch users - who have no hover state - can still
 * reach the toolbar by tabbing/tapping into a field). A block-level onBlur fires even when focus is
 * only moving between two fields inside the SAME block, so it's deferred one tick and re-checked
 * against document.activeElement before actually closing.
 *
 * On mobile, EditableField's handleFocus immediately blurs the field and opens MobileFieldSheet
 * (portaled to document.body, outside this block's DOM) - without the openMobileSheetCount check
 * below, that blur would fail the "is focus still inside me" test and hide the toolbar (including
 * the drag handle) the instant the sheet opens, making it unreachable on touch. Keeping the block
 * active for as long as any sheet is open means the toolbar is still there once the user closes it
 * - the trade-off is it can stay visible until the user focuses a different field, rather than
 * auto-hiding the moment the sheet closes (there's no "tap elsewhere to blur" gesture on mobile to
 * hang that off), which is an acceptable one for reachability over strict tidiness. */
export function useBlockActive() {
  const [isActive, setIsActive] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlers = {
    onMouseEnter: () => setIsActive(true),
    // Deliberately NOT sheet-aware, unlike onBlur below: openMobileSheetCount is global, not
    // scoped to this block, so treating a sheet open ANYWHERE as "still active" here would leave
    // an unrelated block's toolbar stuck open too if it was ever hovered (mouse, not touch) while
    // some other block's sheet happened to be open. onBlur doesn't have this problem, since only
    // the block whose OWN field triggered the blur-and-sheet-open ever runs into that timing race.
    onMouseLeave: () => {
      if (!ref.current?.contains(document.activeElement)) setIsActive(false);
    },
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setIsActive(true);
    },
    onBlur: () => {
      blurTimer.current = setTimeout(() => {
        if (!ref.current?.contains(document.activeElement) && openMobileSheetCount === 0) setIsActive(false);
      }, 0);
    },
  };

  return { isActive, ref, handlers };
}

/** Portal-to-document.body toolbar anchored just above `anchorRef`'s block, escaping the resume
 * sheet's transformed/clipped ancestor (see ResumePreviewPane.tsx) the same way BulletImproveMenu's
 * computePopoverStyle-based menu already does - this one hugs the top edge of its block instead of
 * opening a dropdown below it, matching a small persistent action bar rather than a menu. */
function FloatingToolbar({ anchorRef, children }: { anchorRef: RefObject<HTMLElement | null>; children: ReactNode }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      if (anchorRef.current) setRect(anchorRef.current.getBoundingClientRect());
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
    // Runs once per mount, not on every position-driven re-render: getBoundingClientRect()
    // returns a new object each call, so re-running this without a dependency array on every
    // render would setRect a new reference every time and re-render forever. A fresh
    // FloatingToolbar instance is what handles a different anchor (isActive false->true remounts
    // it), so anchorRef itself never changes under one instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!rect || typeof document === "undefined") return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: Math.max(4, rect.top - 30),
        left: Math.max(4, rect.left),
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: "2px",
        padding: "3px",
        borderRadius: "6px",
        backgroundColor: "#1f2937",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        color: "#fff",
      }}
      onMouseDown={(e) => e.preventDefault()} // don't steal focus from the field being edited
    >
      {children}
    </div>,
    document.body
  );
}

/** Pointer + keyboard sensors shared by every sortable list on the canvas (bullets, roles,
 * projects) - keyboard support (arrow keys once a drag handle has focus, matching dnd-kit's
 * standard accessible sortable pattern) comes for free from using the same sensor set everywhere,
 * rather than only wiring pointer drag. */
export function useDndSensors() {
  return useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
}

export { DndContext, SortableContext, closestCenter, verticalListSortingStrategy };
export type { DragEndEvent };

/** Entering a nested block (e.g. a bullet) from outside the whole structure also fires the
 * browser's own mouseenter on every ancestor block it's nested in (a bullet's <li> sits inside its
 * role's block, so the pointer genuinely enters both boxes at once) - without this, hovering one
 * bullet would pop open both its own toolbar and its parent role's at the same time. Each
 * DraggableBlock reports its own active state up through this context so an ancestor block can
 * suppress its toolbar while a descendant's is already showing. */
const DescendantActiveContext = createContext<((active: boolean) => void) | null>(null);

const toolbarButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "22px",
  height: "22px",
  borderRadius: "4px",
  color: "#fff",
  cursor: "pointer",
};

/**
 * Wraps one draggable, removable canvas block (a bullet, a role, a project) - sortable via
 * @dnd-kit/sortable's useSortable (both pointer and keyboard operable through its drag-handle
 * button), with a FloatingToolbar that only appears on hover/focus. Deliberately no visible chrome
 * at rest, unlike this component's predecessor which stamped icons permanently into the resume
 * content - see the Phase 2 cutover-review feedback this replaced.
 *
 * `variant="entry"` (a role/project block) additionally shows a disabled date-range and
 * field-visibility icon stub - both need real data-model work (a structured date range, per-field
 * show/hide flags) this pass deliberately doesn't take on; see the "coming soon" titles. Every
 * variant shows a disabled text-formatting stub for the same reason (no rich-text representation
 * in ResumeContent yet).
 */
export function DraggableBlock({
  id,
  as = "div",
  style,
  removeLabel,
  onRemove,
  extra,
  variant = "bullet",
  onAddEntry,
  addEntryLabel,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  children,
}: {
  id: string;
  as?: "div" | "li";
  style?: CSSProperties;
  removeLabel: string;
  onRemove: () => void;
  extra?: ReactNode;
  /** "entry" = a role/project block (shows the date-range/field-visibility stubs too); "bullet" =
   * a single bullet line. */
  variant?: "entry" | "bullet";
  /** Adds a new child bullet (role/project block) or sibling bullet (bullet block) - same
   * underlying action either way, see BaseResumeTemplate.tsx's callers. Omit to hide the button. */
  onAddEntry?: () => void;
  addEntryLabel?: string;
  /** Explicit reorder buttons alongside the existing drag handle - keyboard/touch users get a
   * one-tap way to reorder without needing dnd-kit's drag gesture. Omit either to hide both
   * buttons (e.g. a list with only one item). */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { isActive, ref: activeRef, handlers } = useBlockActive();
  const [hasActiveDescendant, setHasActiveDescendant] = useState(false);

  // Memoized so its identity is stable across renders - an unstable ref callback makes React
  // detach-then-reattach it on every render (even when the underlying DOM node hasn't changed),
  // which raced FloatingToolbar's mount: its layout effect read activeRef.current before the
  // reattachment had run, seeing null instead of the anchor element.
  const setRefs = useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      activeRef.current = node;
    },
    [setNodeRef, activeRef]
  );

  const notifyAncestor = useContext(DescendantActiveContext);
  useEffect(() => {
    notifyAncestor?.(isActive);
    return () => notifyAncestor?.(false);
  }, [isActive, notifyAncestor]);

  const Tag = as as "div";
  const showToolbar = isActive && !hasActiveDescendant;

  return (
    <Tag
      ref={setRefs as Ref<HTMLDivElement>}
      style={{
        ...style,
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
      }}
      {...handlers}
    >
      <DescendantActiveContext.Provider value={setHasActiveDescendant}>{children}</DescendantActiveContext.Provider>
      {showToolbar && (
        <FloatingToolbar anchorRef={activeRef}>
          {onAddEntry && (
            <button
              type="button"
              aria-label={addEntryLabel ?? "Add"}
              title={addEntryLabel ?? "Add"}
              onClick={onAddEntry}
              style={{ ...toolbarButtonStyle, backgroundColor: "var(--color-accent, #ca5933)" }}
            >
              <PlusIcon style={{ width: "14px", height: "14px" }} strokeWidth={2.75} />
            </button>
          )}
          {(onMoveUp || onMoveDown) && (
            <>
              <button
                type="button"
                aria-label="Move up"
                disabled={!onMoveUp || !canMoveUp}
                onClick={onMoveUp}
                style={{ ...toolbarButtonStyle, opacity: !onMoveUp || !canMoveUp ? 0.35 : 1, cursor: !onMoveUp || !canMoveUp ? "not-allowed" : "pointer" }}
              >
                <ArrowUpIcon style={{ width: "13px", height: "13px" }} strokeWidth={2.75} />
              </button>
              <button
                type="button"
                aria-label="Move down"
                disabled={!onMoveDown || !canMoveDown}
                onClick={onMoveDown}
                style={{ ...toolbarButtonStyle, opacity: !onMoveDown || !canMoveDown ? 0.35 : 1, cursor: !onMoveDown || !canMoveDown ? "not-allowed" : "pointer" }}
              >
                <ArrowDownIcon style={{ width: "13px", height: "13px" }} strokeWidth={2.75} />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Drag to reorder"
            style={{ ...toolbarButtonStyle, cursor: "grab", touchAction: "none" }}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon style={{ width: "14px", height: "14px" }} strokeWidth={2.5} />
          </button>
          <button type="button" aria-label="Text formatting" title="Text formatting - coming soon" disabled style={{ ...toolbarButtonStyle, opacity: 0.35, cursor: "not-allowed" }}>
            <TypeIcon style={{ width: "13px", height: "13px" }} strokeWidth={2.75} />
          </button>
          {variant === "entry" && (
            <button type="button" aria-label="Date range" title="Date range picker - coming soon" disabled style={{ ...toolbarButtonStyle, opacity: 0.35, cursor: "not-allowed" }}>
              <CalendarIcon style={{ width: "13px", height: "13px" }} strokeWidth={2.75} />
            </button>
          )}
          {extra}
          <button type="button" aria-label={removeLabel} onClick={onRemove} style={toolbarButtonStyle}>
            <TrashIcon style={{ width: "14px", height: "14px" }} strokeWidth={2.5} />
          </button>
          {variant === "entry" && (
            <button type="button" aria-label="Field visibility" title="Show/hide fields - coming soon" disabled style={{ ...toolbarButtonStyle, opacity: 0.35, cursor: "not-allowed" }}>
              <SettingsIcon style={{ width: "13px", height: "13px" }} strokeWidth={2.75} />
            </button>
          )}
        </FloatingToolbar>
      )}
    </Tag>
  );
}

/**
 * The Phase 2 WYSIWYG canvas's editable leaf: a borderless native input/textarea that inherits
 * the exact style object the surrounding static text already uses (buildTemplateStyles' output),
 * so it's pixel-identical to the resume's print appearance when unfocused - the only new chrome is
 * a soft hover/focus tint. Auto-grows for multiline (same imperative scrollHeight technique the
 * now-superseded sidebar BulletEditor used). Never rendered by the PDF export path (that always
 * calls the non-editable branch of each call site), so print fidelity is untouched by construction.
 *
 * A native input swallows clicks meant for cursor placement, so a flagged field's "click to open
 * the fact-check fix" affordance can't live on the text itself once it's editable - it moves to a
 * small flag glyph rendered immediately after the field. The field itself keeps the tint/underline
 * and `data-fc-target` for visual parity and Phase 3's DOM-order highlight anchoring.
 */
export function EditableField({
  as = "input",
  value,
  onChange,
  onBlur,
  style,
  inputStyle,
  targetKey,
  highlight,
  onHighlightActivate,
  placeholder,
  ariaLabel,
  spellCheckEnabled,
  knownWords,
}: {
  as?: "input" | "textarea";
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** The same computed CSSProperties object the static (non-editable) render of this leaf uses. */
  style?: CSSProperties;
  /** Extra overrides layered on top of `style` - e.g. fontWeight/fontStyle standing in for the
   * <strong>/<i> wrapping a static HighlightSpan would otherwise use. */
  inputStyle?: CSSProperties;
  targetKey?: string;
  highlight?: "flagged" | "active";
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  placeholder?: string;
  ariaLabel?: string;
  /** AU spellcheck - opt-in per field (only prose fields: summary, bullets), not every field, to
   * keep names/companies/dates from generating false-positive noise. See lib/text/spellcheck.ts. */
  spellCheckEnabled?: boolean;
  /** This resume's own company/skill/tool/name words - checked before the dictionary so a real
   * proper noun already used elsewhere in the resume never gets flagged as misspelled here. */
  knownWords?: Set<string>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [misspellings, setMisspellings] = useState<Misspelling[]>([]);
  const [showSpellingPopover, setShowSpellingPopover] = useState(false);
  const spellingGlyphRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  // knownWords is read via a ref, not a dependency: it's a new Set reference on every render of
  // the whole resume (BaseResumeTemplate rebuilds it from `resume`, which changes on every
  // keystroke anywhere, not just in this field), so depending on it directly would cancel and
  // reschedule this debounce on every unrelated edit - typing continuously in the summary would
  // keep resetting every bullet's timer, and none of them would ever actually run the check.
  const knownWordsRef = useRef(knownWords);
  knownWordsRef.current = knownWords;

  useEffect(() => {
    if (!spellCheckEnabled) {
      setMisspellings([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const checker = await getSpellChecker();
        if (!cancelled) setMisspellings(checkSpelling(value, checker, knownWordsRef.current ?? new Set()));
      } catch {
        // Dictionary failed to load (e.g. offline) - fail quiet, same as any other field simply
        // not showing spelling flags. getSpellChecker itself clears its cache so a later field's
        // check gets a fresh retry rather than reusing the same failure forever.
      }
    }, SPELLCHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [spellCheckEnabled, value]);

  // Replaces the first whole-word, case-insensitive occurrence of a misspelled word with the
  // chosen suggestion - explicit accept, never applied automatically.
  function applySpellingFix(word: string, suggestion: string) {
    const pattern = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    onChange(
      value.replace(pattern, (matched) => {
        // Preserve the actual matched text's capitalisation - checkSpelling's word came from
        // tokenising the field's own text and may differ in case (e.g. a resume-edit-time re-check
        // vs. this specific popover click), and a sentence-initial word losing its capital letter
        // would look like a new mistake, not a fix.
        if (matched === matched.toUpperCase() && matched !== matched.toLowerCase()) return suggestion.toUpperCase();
        if (matched[0] === matched[0]?.toUpperCase()) return suggestion[0].toUpperCase() + suggestion.slice(1);
        return suggestion;
      })
    );
    setShowSpellingPopover(false);
  }

  // On a phone, the inline field is too small to type into comfortably on a paginated A4 page -
  // redirect focus into an enlarged bottom-sheet editor instead. Structural/AI controls stay on
  // the canvas itself (already touch-usable, not hover-gated) - the sheet's only job is comfortable
  // typing, so it doesn't need to duplicate them.
  function handleFocus() {
    if (!isMobile) return;
    (document.activeElement as HTMLElement | null)?.blur();
    setIsSheetOpen(true);
  }

  const resetStyle: CSSProperties = {
    border: 0,
    outline: "none",
    background: "transparent",
    margin: 0,
    padding: 0,
    width: "100%",
    color: "inherit",
    font: "inherit",
    lineHeight: "inherit",
    display: "block",
  };
  const hasMisspellings = misspellings.length > 0;
  const mergedStyle: CSSProperties = {
    ...resetStyle,
    ...style,
    // Fact-check takes visual priority on the rare field that somehow has both - a single element
    // can't cleanly show two different underline styles/colours at once, and honesty matters more.
    ...(highlight ? HIGHLIGHT_STYLE[highlight] : hasMisspellings ? SPELLING_UNDERLINE_STYLE : null),
    ...inputStyle,
  };
  // CSS width:auto on a text <input> resolves to the browser's default ~20-character intrinsic
  // width, not shrink-to-fit like it does on a span/div - so an inline field asking for "auto"
  // width (every "Title · Company"-style field on the canvas) rendered as a fixed-width box
  // instead of flowing text, unlike the static/Preview render of the same value. ch approximates
  // shrink-to-fit without a measuring-span (proportional fonts make it inexact, but far closer
  // than a ~170px fixed box); +1ch leaves room for the caret without clipping the last character.
  if (as === "input" && mergedStyle.width === "auto") {
    mergedStyle.width = `${Math.max((value || placeholder || "").length, 1) + 1}ch`;
  }

  const className = "hover:bg-black/[0.035] focus:bg-black/[0.04] focus:outline-none transition-colors";
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value);

  return (
    <>
      {as === "textarea" ? (
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          data-fc-target={targetKey}
          className={className}
          style={mergedStyle}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={onBlur}
        />
      ) : (
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          data-fc-target={targetKey}
          className={className}
          style={mergedStyle}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={onBlur}
        />
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isSheetOpen && (
              <MobileFieldSheet
                as={as}
                value={value}
                onChange={onChange}
                ariaLabel={ariaLabel}
                placeholder={placeholder}
                onClose={() => {
                  onBlur?.();
                  setIsSheetOpen(false);
                }}
              />
            )}
          </AnimatePresence>,
          document.body
        )}
      {highlight && targetKey && onHighlightActivate && (
        <button
          type="button"
          aria-label="Review flagged claim"
          onClick={(e) => {
            e.stopPropagation();
            onHighlightActivate(targetKey, (e.currentTarget as HTMLElement).getBoundingClientRect());
          }}
          style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: "4px", color: "#b45309", cursor: "pointer" }}
        >
          <AlertCircleIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
        </button>
      )}
      {hasMisspellings && (
        <button
          ref={spellingGlyphRef}
          type="button"
          aria-label={`${misspellings.length} possible spelling ${misspellings.length === 1 ? "issue" : "issues"}`}
          onClick={(e) => {
            e.stopPropagation();
            setShowSpellingPopover((prev) => !prev);
          }}
          style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: "4px", color: "#b91c1c", cursor: "pointer" }}
        >
          <AlertTriangleIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
        </button>
      )}
      {showSpellingPopover &&
        typeof document !== "undefined" &&
        spellingGlyphRef.current &&
        createPortal(
          <div className="fixed inset-0 z-50" onClick={() => setShowSpellingPopover(false)}>
            <div
              style={{
                ...computePopoverStyle(spellingGlyphRef.current.getBoundingClientRect(), 220),
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                padding: "6px",
                zIndex: 50,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {misspellings.map((m) => (
                <div key={m.word} style={{ padding: "4px 6px" }}>
                  <div style={{ fontSize: "11px", color: "#b91c1c", fontWeight: 600, marginBottom: "2px" }}>{m.word}</div>
                  {m.suggestions.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {m.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => applySpellingFix(m.word, suggestion)}
                          style={{
                            fontSize: "11px",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            border: "1px solid #d1d5db",
                            background: "#f9fafb",
                            color: "#111827",
                            cursor: "pointer",
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#6b7280" }}>No suggestions</span>
                  )}
                </div>
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** EditableField's mobile fallback: a bottom-sheet with an enlarged copy of the same field, for
 * comfortable typing on a small paginated page. Same slide-up chrome as the app's other
 * bottom sheets (e.g. FactCheckFixPanel's mobile branch). Purely a bigger text editor - structural
 * (move/remove/add) and AI-assist controls stay on the canvas itself, reachable once this closes. */
function MobileFieldSheet({
  as,
  value,
  onChange,
  onClose,
  ariaLabel,
  placeholder,
}: {
  as: "input" | "textarea";
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const fieldStyle: CSSProperties = {
    width: "100%",
    minHeight: as === "textarea" ? "120px" : undefined,
    fontSize: "16px", // >=16px stops iOS Safari auto-zooming on focus
    lineHeight: 1.4,
    border: "1px solid #cbd5e1",
    borderRadius: "8px",
    padding: "10px 12px",
    resize: "vertical",
  };

  // Keeps the originating block's toolbar reachable across this sheet's whole open/close lifecycle
  // - see openMobileSheetCount's comment on useBlockActive above.
  useEffect(() => {
    openMobileSheetCount += 1;
    return () => {
      openMobileSheetCount -= 1;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <motion.div
        className="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-4"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        {as === "textarea" ? (
          <textarea
            autoFocus
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            style={fieldStyle}
            onChange={(e) => onChange(e.target.value)}
            data-canvas-field="true"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            style={fieldStyle}
            onChange={(e) => onChange(e.target.value)}
            data-canvas-field="true"
          />
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: "12px",
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            backgroundColor: "var(--color-accent, #ca5933)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Done
        </button>
      </motion.div>
    </div>
  );
}

/**
 * Inline honesty-fact-check highlight, shared by ATSSafeTemplate and DesignForwardTemplate. Amber
 * only, never red - a hard rule from the spec this build follows - and calm by design (thin
 * underline plus a soft tint, "active" only a touch stronger) so the resume preview never reads
 * as "your resume is bad" at a glance. Renders a plain (unstyled, but still tagged with
 * data-fc-target for the counter's DOM-order jump-to-next logic) element when `highlight` is
 * unset, so a caller that never passes highlights renders exactly as before.
 */
export function HighlightSpan({
  targetKey,
  highlight,
  onActivate,
  as = "span",
  children,
  editable,
  editableAs = "input",
  value,
  onChange,
  onBlur,
  inputStyle,
  ariaLabel,
  spellCheckEnabled,
  knownWords,
}: {
  targetKey: string;
  highlight?: "flagged" | "active";
  onActivate?: (targetKey: string, rect: DOMRect) => void;
  as?: "span" | "strong" | "i";
  children: ReactNode;
  /** Renders an EditableField instead of the static tag below - `as`/`children` are ignored in
   * this branch (an input can't be a nested <strong>/<i>; use `inputStyle` for that instead). */
  editable?: boolean;
  editableAs?: "input" | "textarea";
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  inputStyle?: CSSProperties;
  ariaLabel?: string;
  spellCheckEnabled?: boolean;
  knownWords?: Set<string>;
}) {
  if (editable) {
    return (
      <EditableField
        as={editableAs}
        value={value ?? ""}
        onChange={onChange ?? (() => {})}
        onBlur={onBlur}
        inputStyle={inputStyle}
        targetKey={targetKey}
        highlight={highlight}
        onHighlightActivate={onActivate}
        ariaLabel={ariaLabel}
        spellCheckEnabled={spellCheckEnabled}
        knownWords={knownWords}
      />
    );
  }
  const Tag = as as any;
  if (!highlight) return <Tag data-fc-target={targetKey}>{children}</Tag>;
  return (
    <Tag
      data-fc-target={targetKey}
      onClick={(e: MouseEvent) => {
        if (!onActivate) return;
        e.stopPropagation();
        onActivate(targetKey, (e.currentTarget as HTMLElement).getBoundingClientRect());
      }}
      style={{
        cursor: onActivate ? "pointer" : undefined,
        textDecoration: "underline",
        textDecorationColor: highlight === "active" ? "#b45309" : "#d97706",
        textDecorationThickness: highlight === "active" ? "2px" : "1px",
        // Kept small deliberately: at the floor font size (9.5pt) line spacing is tight enough
        // that a larger offset visually bleeds the underline/background into the next line.
        textUnderlineOffset: "1px",
        backgroundColor: highlight === "active" ? "rgba(217,119,6,0.18)" : "rgba(217,119,6,0.10)",
        borderRadius: "2px",
      }}
    >
      {children}
    </Tag>
  );
}

/** Section-level "+ Add" affordance (add a whole new role/project entry), revealed on hover over
 * the section heading itself - the section-scoped counterpart to DraggableBlock's per-entry
 * "+Entry" button, which only adds a child bullet. Not a DraggableBlock (a section heading isn't
 * itself draggable/removable via this control - see EditorToolbar's "Reorder sections" for that). */
export function SectionHeading({
  title,
  style,
  editable,
  onAdd,
  addLabel,
}: {
  title: string;
  style: CSSProperties;
  editable?: boolean;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const { isActive, ref, handlers } = useBlockActive();
  return (
    <div ref={ref as Ref<HTMLDivElement>} style={{ position: "relative" }} {...(editable ? handlers : {})}>
      <h2 style={style}>{title}</h2>
      {editable && onAdd && isActive && (
        <button
          type="button"
          aria-label={addLabel ?? "Add"}
          title={addLabel ?? "Add"}
          onClick={onAdd}
          className="print:hidden"
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "22px",
            height: "22px",
            borderRadius: "9999px",
            backgroundColor: "var(--color-accent, #ca5933)",
            color: "#fff",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
          }}
        >
          <PlusIcon style={{ width: "13px", height: "13px" }} strokeWidth={2.75} />
        </button>
      )}
    </div>
  );
}

export function RoleHeaderLine({
  left,
  dates,
  style,
}: {
  left: ReactNode;
  dates: ReactNode;
  style: Record<string, CSSProperties>;
}) {
  return (
    <div style={style.roleHeaderLine}>
      <span style={style.roleHeaderLeft}>{left}</span>
      <span style={style.dates}>{dates}</span>
    </div>
  );
}

export function BulletList({
  bullets,
  bulletIds,
  style,
  targetKind,
  entryIndex,
  highlights,
  onHighlightActivate,
  editable,
  onBulletChange,
  onBulletBlur,
  onBulletRemove,
  onBulletReorder,
  onBulletAdd,
  renderBulletExtra,
  spellCheckEnabled,
  knownWords,
}: {
  bullets: string[];
  /** Stable per-bullet ids for dnd-kit's sortable identity - required when `editable`. Must stay
   * the same across keystroke-only re-renders (only regenerate when the bullet count changes),
   * or dnd-kit and React both lose track of which DOM node is which mid-drag/mid-typing. */
  bulletIds?: string[];
  style: Record<string, CSSProperties>;
  targetKind: "experienceBullet" | "projectBullet";
  entryIndex: number;
  highlights: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  editable?: boolean;
  onBulletChange?: (bulletIndex: number, value: string) => void;
  onBulletBlur?: () => void;
  onBulletRemove?: (bulletIndex: number) => void;
  onBulletReorder?: (from: number, to: number) => void;
  /** Adds a new bullet to this same list - surfaced on every bullet's floating toolbar (the "+"
   * button), not just a trailing "+ Add bullet" link. */
  onBulletAdd?: () => void;
  /** Slot for a caller-supplied extra control per bullet (e.g. the canvas's AI-assist trigger) -
   * BulletList stays domain-agnostic (no resumeId/AI-endpoint knowledge) by not owning this itself. */
  renderBulletExtra?: (bulletIndex: number) => ReactNode;
  spellCheckEnabled?: boolean;
  knownWords?: Set<string>;
}) {
  const sensors = useDndSensors();

  if (!editable) {
    return (
      <ul style={style.bulletList}>
        {bullets.map((bullet, j) => {
          const key = factCheckTargetKey({ kind: targetKind, index: entryIndex, bulletIndex: j });
          return (
            <li key={j} style={style.bullet}>
              <span aria-hidden="true">• </span>
              <HighlightSpan targetKey={key} highlight={highlights[key]} onActivate={onHighlightActivate}>
                {bullet}
              </HighlightSpan>
            </li>
          );
        })}
      </ul>
    );
  }

  const ids = bulletIds ?? bullets.map((_, j) => String(j));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from !== -1 && to !== -1) onBulletReorder?.(from, to);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul style={style.bulletList}>
          {bullets.map((bullet, j) => {
            const key = factCheckTargetKey({ kind: targetKind, index: entryIndex, bulletIndex: j });
            return (
              <DraggableBlock
                key={ids[j]}
                id={ids[j]}
                as="li"
                style={{ ...style.bullet, display: "flex", alignItems: "flex-start", gap: "4px" }}
                removeLabel="Remove bullet"
                onRemove={() => onBulletRemove?.(j)}
                extra={renderBulletExtra?.(j)}
                variant="bullet"
                onAddEntry={onBulletAdd}
                addEntryLabel="Add bullet"
                onMoveUp={j > 0 ? () => onBulletReorder?.(j, j - 1) : undefined}
                onMoveDown={j < bullets.length - 1 ? () => onBulletReorder?.(j, j + 1) : undefined}
              >
                <span aria-hidden="true">• </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <HighlightSpan
                    targetKey={key}
                    highlight={highlights[key]}
                    onActivate={onHighlightActivate}
                    editable
                    editableAs="textarea"
                    value={bullet}
                    onChange={(value) => onBulletChange?.(j, value)}
                    onBlur={onBulletBlur}
                    ariaLabel="Bullet point"
                    spellCheckEnabled={spellCheckEnabled}
                    knownWords={knownWords}
                  >
                    {bullet}
                  </HighlightSpan>
                </div>
              </DraggableBlock>
            );
          })}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

export function ToolRow({
  tool,
  index,
  style,
  labelStyle,
  highlights,
  onHighlightActivate,
  editable,
  onChange,
  onBlur,
}: {
  tool: string;
  index: number;
  style: CSSProperties;
  labelStyle?: CSSProperties;
  highlights: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  editable?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}) {
  const key = factCheckTargetKey({ kind: "tool", index });

  if (editable) {
    // The bold "Category:" prefix can't be reproduced inside one plain input - editable mode
    // renders the whole string uniform-weight; the non-editable/export render below keeps the
    // exact bold-prefix split byte-for-byte.
    return (
      <p style={style}>
        <HighlightSpan
          targetKey={key}
          highlight={highlights[key]}
          onActivate={onHighlightActivate}
          editable
          editableAs="textarea"
          value={tool}
          onChange={onChange}
          onBlur={onBlur}
          ariaLabel="Tool category"
          inputStyle={{ width: "100%", wordBreak: "break-word", lineHeight: "inherit", resize: "none", overflow: "hidden" }}
        >
          {tool}
        </HighlightSpan>
      </p>
    );
  }

  const separator = tool.indexOf(":");
  const content =
    separator === -1 ? (
      tool
    ) : (
      <>
        <strong style={labelStyle}>{tool.slice(0, separator + 1)}</strong>
        {tool.slice(separator + 1)}
      </>
    );
  return (
    <p style={style}>
      <HighlightSpan targetKey={key} highlight={highlights[key]} onActivate={onHighlightActivate}>
        {content}
      </HighlightSpan>
    </p>
  );
}
