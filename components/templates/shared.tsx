"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
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
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons/LucideIcons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import type { ReviewPassage } from "@/lib/review/types";
import { factCheckTargetKey } from "@/types";

const MIRROR_PROPS = [
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "fontKerning",
  "lineHeight",
  "letterSpacing",
  "wordSpacing",
  "textTransform",
  "textAlign",
  "textIndent",
  "tabSize",
  "wordBreak",
] as const;

// Review highlights: a tint plus a 2px underline in a dark shade, so the mark holds >= 3:1 against the
// white page (the tint alone cannot). Line style differs by severity too (single = check this, double =
// verify), so colour is never the only signal.
const PASSAGE_STYLE: Record<ReviewPassage["severity"], { tint: string; activeTint: string; line: string; decoration: "solid" | "double" }> = {
  warn: { tint: "rgba(217,119,6,0.16)", activeTint: "rgba(217,119,6,0.32)", line: "#b45309", decoration: "solid" },
  verify: { tint: "rgba(220,38,38,0.14)", activeTint: "rgba(220,38,38,0.30)", line: "#b91c1c", decoration: "double" },
};

function passageStyle(passage: ReviewPassage, selected: boolean): CSSProperties {
  const look = PASSAGE_STYLE[passage.severity];
  return {
    backgroundColor: selected ? look.activeTint : look.tint,
    textDecorationLine: "underline",
    textDecorationStyle: look.decoration,
    textDecorationColor: look.line,
    textDecorationThickness: "2px",
    textUnderlineOffset: "2px",
    borderRadius: "2px",
  };
}

/** What the editor's single review list tells the preview: which passages to highlight per block, which
 * card is selected, and how a click on a highlight selects its card. Provided once by ResumeEditor. */
export const ReviewHighlightContext = createContext<{
  passages: ReadonlyMap<string, ReviewPassage[]>;
  selectedItemId: string | null;
  onSelectItem: (itemId: string) => void;
}>({ passages: new Map(), selectedItemId: null, onSelectItem: () => {} });

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
/** Which level of the resume a toolbar acts on. Named in words at its left edge ("Role", "Bullet",
 * "Skills"...) with a small dot per level, so "this moves the section" vs "this moves the role" vs
 * "this moves the bullet" is clear without relying on colour alone. */
type ToolbarLevel = "section" | "item" | "bullet";
const LEVEL_DOT: Record<ToolbarLevel, string> = {
  section: "bg-amber-400",
  item: "bg-orange-400",
  bullet: "bg-stone-400",
};

const TOOLBAR_BUTTON =
  "inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-md px-1.5 text-xs font-semibold text-surface transition-colors duration-fast ease-editorial hover:bg-surface/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-surface disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";
const TOOLBAR_TONE = {
  default: "",
  primary: "bg-accent hover:bg-accent-hover",
  danger: "hover:bg-critical",
} as const;

/** One control in a floating toolbar. `label` is both its accessible name and its hover tooltip, so an
 * icon-only button is never a mystery. Any extra button props (the drag handle's listeners) pass through. */
function ToolbarButton({
  label,
  tone = "default",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: keyof typeof TOOLBAR_TONE }) {
  return (
    <button type="button" aria-label={label} title={label} className={`${TOOLBAR_BUTTON} ${TOOLBAR_TONE[tone]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

/** Thin rule between groups of controls: adding | moving | removing. */
const ToolbarDivider = () => <span aria-hidden="true" className="mx-0.5 h-4 w-px shrink-0 bg-surface/20" />;

function FloatingToolbar({
  anchorRef,
  level,
  label,
  lift = 0,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  level: ToolbarLevel;
  label: string;
  /** Extra pixels above the block, to clear something that sits on its top edge (the section's "+"). */
  lift?: number;
  children: ReactNode;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Re-measures after every render, but only commits a *changed* position - so a block that moves
  // (a section reordered, a role that grew a bullet) drags its toolbar with it, without the
  // new-DOMRect-every-time endless re-render the mount-only effect below exists to avoid.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately every render; the equality guard stops the loop
  useLayoutEffect(() => {
    const next = anchorRef.current?.getBoundingClientRect();
    if (!next) return;
    setRect((prev) => (prev && prev.top === next.top && prev.left === next.left ? prev : next));
  });

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
      role="toolbar"
      aria-label={`${label} actions`}
      // Tells the editor's click-outside-to-deselect listener this isn't "outside": the toolbar only
      // exists while its block is selected, so deselecting on press would unmount it mid-click.
      data-selection-keep
      className="fixed z-50 flex items-center gap-0.5 rounded-xl bg-ink p-1 text-surface shadow-lg ring-1 ring-black/10"
      style={{ top: Math.max(4, rect.top - 38 - lift), left: Math.max(4, rect.left) }}
      onMouseDown={(e) => e.preventDefault()} // don't steal focus from the field being edited
    >
      <span className="flex items-center gap-1.5 whitespace-nowrap pl-2 pr-2.5 text-[11px] font-semibold uppercase tracking-wide text-surface/80">
        <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[level]}`} />
        {label}
      </span>
      <ToolbarDivider />
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

export { DndContext, SortableContext, closestCenter, rectSortingStrategy, verticalListSortingStrategy };
export type { DragEndEvent };

/** Set by a selection-controlled DraggableBlock (role/project/...) for its subtree: null = no gate
 * (hover-reveal, as before), true/false = whether that block is the current selection. A bullet
 * inside only shows its own toolbar while its containing block is selected. */
const SelectionGateContext = createContext<boolean | null>(null);

/** Entering a nested block (e.g. a bullet) from outside the whole structure also fires the
 * browser's own mouseenter on every ancestor block it's nested in (a bullet's <li> sits inside its
 * role's block, so the pointer genuinely enters both boxes at once) - without this, hovering one
 * bullet would pop open both its own toolbar and its parent role's at the same time. Each
 * DraggableBlock reports its own active state up through this context so an ancestor block can
 * suppress its toolbar while a descendant's is already showing. */
const DescendantActiveContext = createContext<((active: boolean) => void) | null>(null);

/**
 * Wraps one draggable, removable canvas block (a bullet, a role, a project) - sortable via
 * @dnd-kit/sortable's useSortable (both pointer and keyboard operable through its drag-handle
 * button), with a FloatingToolbar that only appears on hover/focus. Deliberately no visible chrome
 * at rest, unlike this component's predecessor which stamped icons permanently into the resume
 * content - see the Phase 2 cutover-review feedback this replaced.
 */
export function DraggableBlock({
  id,
  as = "div",
  style,
  removeLabel,
  onRemove,
  extra,
  onAddEntry,
  addEntryLabel,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  zone,
  selected,
  levelLabel = "Bullet",
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
  /** Selectable-zone props (data-section/role/onClick/style - see BaseResumeTemplate's
   * getZoneProps) so this block can be selected as an item-level highlight. */
  zone?: Record<string, unknown>;
  /** When defined, the toolbar shows only while true (selection-driven) instead of on hover/focus. */
  selected?: boolean;
  /** Names what this toolbar acts on ("Role", "Project", "Skill"...), shown as its level chip. */
  levelLabel?: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { isActive, ref: activeRef, handlers } = useBlockActive();
  // A count, not a boolean: two descendants can be active at once (one hovered, one focused), and a
  // boolean would flip back to "none active" the moment the first of them went inactive.
  const [activeDescendants, setActiveDescendants] = useState(0);
  const hasActiveDescendant = activeDescendants > 0;
  const trackDescendant = useCallback((active: boolean) => setActiveDescendants((n) => Math.max(0, n + (active ? 1 : -1))), []);

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
    if (!isActive || !notifyAncestor) return;
    notifyAncestor(true);
    return () => notifyAncestor(false);
  }, [isActive, notifyAncestor]);

  const Tag = as as "div";
  const gate = useContext(SelectionGateContext);
  const showToolbar = (selected ?? (gate === null ? isActive : isActive && gate)) && !hasActiveDescendant;

  return (
    <Tag
      {...zone}
      ref={setRefs as Ref<HTMLDivElement>}
      style={{
        ...style,
        ...(zone?.style as CSSProperties | undefined),
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.4 : 1,
        position: "relative",
      }}
      {...handlers}
    >
      <DescendantActiveContext.Provider value={trackDescendant}>
        {selected === undefined ? children : <SelectionGateContext.Provider value={selected}>{children}</SelectionGateContext.Provider>}
      </DescendantActiveContext.Provider>
      {showToolbar && (
        <FloatingToolbar anchorRef={activeRef} level={levelLabel === "Bullet" ? "bullet" : "item"} label={levelLabel}>
          {onAddEntry && (
            <>
              <ToolbarButton label={addEntryLabel ?? "Add"} tone="primary" onClick={onAddEntry} className="pl-1.5 pr-2">
                <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                {addEntryLabel ?? "Add"}
              </ToolbarButton>
              <ToolbarDivider />
            </>
          )}
          {(onMoveUp || onMoveDown) && (
            <ToolbarButton label="Move up" disabled={!onMoveUp || !canMoveUp} onClick={onMoveUp}>
              <ArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2} />
            </ToolbarButton>
          )}
          {(onMoveUp || onMoveDown) && (
            <ToolbarButton label="Move down" disabled={!onMoveDown || !canMoveDown} onClick={onMoveDown}>
              <ArrowDownIcon className="h-3.5 w-3.5" strokeWidth={2} />
            </ToolbarButton>
          )}
          <ToolbarButton label="Drag to reorder" className="cursor-grab touch-none" {...attributes} {...listeners}>
            <GripVerticalIcon className="h-3.5 w-3.5" strokeWidth={2} />
          </ToolbarButton>
          {extra && (
            <>
              <ToolbarDivider />
              {extra}
            </>
          )}
          <ToolbarDivider />
          <ToolbarButton label={removeLabel} tone="danger" onClick={onRemove}>
            <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
          </ToolbarButton>
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
 * Review highlights (see ReviewHighlightContext) are drawn from the editor's single review list; clicking
 * one selects its card in the review panel. The field carries `data-fc-target` so the panel can scroll to it.
 */
export function EditableField({
  as = "input",
  value,
  onChange,
  onBlur,
  style,
  inputStyle,
  targetKey,
  placeholder,
  ariaLabel,
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
  /** Also the field's review block id: the review list highlights this field's passages under it. */
  targetKey?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const { passages, selectedItemId, onSelectItem } = useContext(ReviewHighlightContext);
  const fieldPassages = useMemo(
    () =>
      (targetKey ? passages.get(targetKey) ?? [] : [])
        .filter((p) => p.start < value.length)
        .map((p) => ({ ...p, end: Math.min(p.end, value.length) })),
    [passages, targetKey, value]
  );

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

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
    backgroundColor: "transparent",
    resize: "none",
    margin: 0,
    padding: 0,
    width: "100%",
    color: "inherit",
    font: "inherit",
    lineHeight: "inherit",
    display: "block",
  };
  const hasPassages = fieldPassages.length > 0;
  // A textarea can't tint its own text tightly (background fills the whole box), so a transparent-text
  // mirror sits behind it with exactly each passage marked, text-selection style. The wrapper is stable
  // for a field's life, so a passage appearing never remounts the textarea and drops focus. Inputs fall
  // back to tinting the whole field.
  const useMirror = as === "textarea";
  const mirrorRef = useRef<HTMLDivElement>(null);
  const wholeFieldStyle: CSSProperties | null =
    hasPassages && !useMirror
      ? {
          ...passageStyle(
            fieldPassages.reduce((a, b) => (b.severity === "verify" ? b : a)),
            fieldPassages.some((p) => p.itemIds.includes(selectedItemId ?? ""))
          ),
          cursor: "pointer",
        }
      : null;
  const mergedStyle: CSSProperties = { ...resetStyle, ...style, ...wholeFieldStyle, ...inputStyle };
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
  const handleClick = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    // Mobile taps already open the enlarged edit sheet (handleFocus), so leave selection to the panel there.
    if (!hasPassages || isMobile) return;
    // With the mirror only the marked passages are targets: select the card when the caret landed in one.
    const caret = e.currentTarget.selectionStart ?? -1;
    const hit = useMirror ? fieldPassages.find((p) => caret >= p.start && caret <= p.end) : fieldPassages[0];
    if (hit) onSelectItem(hit.itemIds[0]);
  };
  // Mirror the textarea's *computed* text metrics rather than re-deriving them from style props, so
  // the tint lines up with the real text whatever font/spacing the caller styled it with.
  useLayoutEffect(() => {
    const target = textareaRef.current;
    const el = mirrorRef.current;
    if (!useMirror || !target || !el) return;
    const computed = getComputedStyle(target);
    for (const prop of MIRROR_PROPS) el.style[prop] = computed[prop];
  });
  const mirror = useMirror && hasPassages && (
    <div
      ref={mirrorRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        color: "transparent",
        whiteSpace: "pre-wrap",
        overflowWrap: "break-word",
      }}
    >
      {fieldPassages.map((passage, i) => (
        <Fragment key={passage.start}>
          {value.slice(i > 0 ? fieldPassages[i - 1].end : 0, passage.start)}
          <mark
            data-review-passage={passage.itemIds[0]}
            style={{
              ...passageStyle(passage, passage.itemIds.includes(selectedItemId ?? "")),
              color: "transparent",
              boxDecorationBreak: "clone",
              WebkitBoxDecorationBreak: "clone",
            }}
          >
            {value.slice(passage.start, passage.end)}
          </mark>
        </Fragment>
      ))}
      {value.slice(hasPassages ? fieldPassages[fieldPassages.length - 1].end : 0)}
    </div>
  );

  return (
    <>
      {as === "textarea" ? (
        <div style={{ position: "relative", width: "100%" }}>
          {mirror}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            data-fc-target={targetKey}
            className={className}
            style={{ ...mergedStyle, position: "relative" }}
            onChange={handleChange}
            onClick={handleClick}
            onFocus={handleFocus}
            onBlur={onBlur}
          />
        </div>
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
          onClick={handleClick}
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
        ariaLabel={ariaLabel}
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

/** A plain section heading. The section-level controls (add, move) live in SectionToolbar, shown
 * while the section is selected - not a hover-only button on the heading. */
export function SectionHeading({ title, style }: { title: string; style: CSSProperties }) {
  return <h2 style={style}>{title}</h2>;
}

/** How far the section toolbar rides above its usual spot so the "+" on the section's top edge shows under it. */
const INSERT_HANDLE_CLEARANCE = 28;

/**
 * The round "+" on a selected section's top edge: a shortcut to add an item at the very top, where the
 * new one will appear. It sits just above the edge, clear of the heading; hovering it draws a line across
 * the edge, and clicking swaps it for a pill naming the action. Lives inside the section's zone (position: relative), so it needs no positioning
 * maths and moves with the section. Editor-only: it is only ever mounted with the section toolbar.
 */
function SectionInsertHandle({ label, onInsert }: { label: string; onInsert: () => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const ring = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent/40";
  return (
    <div ref={rootRef} className="group absolute inset-x-0 top-0 z-[2] h-0" data-section-insert>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 -translate-y-1/2 bg-accent transition-opacity duration-fast ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />
      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[calc(100%-4px)] items-center">
        {open ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              onInsert();
            }}
            className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border border-accent bg-white px-2.5 font-sans text-[11px] font-semibold leading-none text-accent shadow-sm hover:bg-accent-soft ${ring}`}
          >
            <PlusIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
            {label}
          </button>
        ) : (
          <button
            type="button"
            aria-label={`${label} at the top of this section`}
            title={`${label} at the top`}
            aria-haspopup="true"
            aria-expanded={false}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-accent bg-white text-accent shadow-sm transition-transform duration-fast hover:scale-110 hover:bg-accent-soft ${ring}`}
          >
            <PlusIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Floating toolbar for a selected SECTION (as opposed to an item or bullet inside it): add an item
 * and move the section up/down. Rendered as a child of the section's zone element, which it uses
 * (via a zero-size marker) as its anchor. Mount it only while the section is selected. */
export function SectionToolbar({
  label,
  onAdd,
  addLabel,
  onInsertFirst,
  onMoveUp,
  onMoveDown,
  onDelete,
  deleteLabel = "Delete section",
}: {
  label: string;
  onAdd?: () => void;
  addLabel?: string;
  /** Adds an item at the very top of the section (the "+" on its top edge). Omit for no handle. */
  onInsertFirst?: () => void;
  /** Empties the section (a resume section itself can't be removed, so this deletes its content;
   * undo restores it). */
  onDelete?: () => void;
  deleteLabel?: string;
  /** Omit (not just disable) for a section that can't be reordered. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const anchorRef = useMemo(() => ({ current: anchor }), [anchor]);
  // Stable callback ref: an inline one is re-invoked (null, then node) on every render, and each call
  // sets state - an endless render loop.
  const markerRef = useCallback((node: HTMLElement | null) => setAnchor(node?.parentElement ?? null), []);
  const reorderable = onMoveUp !== undefined || onMoveDown !== undefined;
  return (
    <>
      <span ref={markerRef} style={{ display: "none" }} />
      {anchor && onInsertFirst && <SectionInsertHandle label={addLabel ?? "Add"} onInsert={onInsertFirst} />}
      {anchor && (
        <FloatingToolbar anchorRef={anchorRef} level="section" label={label} lift={onInsertFirst ? INSERT_HANDLE_CLEARANCE : 0}>
          {onAdd && (
            <>
              <ToolbarButton label={addLabel ?? "Add"} tone="primary" onClick={onAdd} className="pl-1.5 pr-2">
                <PlusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
                {addLabel ?? "Add"}
              </ToolbarButton>
              <ToolbarDivider />
            </>
          )}
          {reorderable && (
            <>
              <ToolbarButton label="Move section up" disabled={!onMoveUp} onClick={onMoveUp}>
                <ArrowUpIcon className="h-3.5 w-3.5" strokeWidth={2} />
              </ToolbarButton>
              <ToolbarButton label="Move section down" disabled={!onMoveDown} onClick={onMoveDown}>
                <ArrowDownIcon className="h-3.5 w-3.5" strokeWidth={2} />
              </ToolbarButton>
            </>
          )}
          {onDelete && (
            <>
              {(onAdd || reorderable) && <ToolbarDivider />}
              <ToolbarButton label={deleteLabel} tone="danger" onClick={onDelete}>
                <TrashIcon className="h-3.5 w-3.5" strokeWidth={2} />
              </ToolbarButton>
            </>
          )}
        </FloatingToolbar>
      )}
    </>
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

