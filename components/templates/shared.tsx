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
import {
  insertMarkupAroundSelection,
  isRangeFormatted,
  parseBulletMarkup,
  serializeBulletRuns,
  stripBulletMarkup,
  type BulletRun,
} from "@/lib/resume/bulletMarkup";
import { BulletFormatToolbar } from "@/components/templates/BulletFormatToolbar";
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
// verify), so colour is never the only signal. "selected" is blue (--info), not amber/red, since it
// doesn't mean "something's wrong here" - only "this is the card you have open".
const PASSAGE_STYLE: Record<ReviewPassage["severity"], { tint: string; activeTint: string; line: string; decoration: "solid" | "double" }> = {
  warn: { tint: "rgba(217,119,6,0.16)", activeTint: "rgba(217,119,6,0.32)", line: "#b45309", decoration: "solid" },
  verify: { tint: "rgba(220,38,38,0.14)", activeTint: "rgba(220,38,38,0.30)", line: "#b91c1c", decoration: "double" },
  selected: { tint: "rgba(29,78,216,0.14)", activeTint: "rgba(29,78,216,0.28)", line: "#1d4ed8", decoration: "solid" },
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
  const isHovered = useRef(false);
  // Popovers a descendant opens from the toolbar (see BlockPinContext) hold the block active: their
  // content is portaled outside this block's DOM, so focus/pointer moving into it would otherwise
  // read as "left the block" and unmount the toolbar - and the popover with it.
  const pinCount = useRef(0);

  const pin = useCallback((pinned: boolean) => {
    pinCount.current = Math.max(0, pinCount.current + (pinned ? 1 : -1));
    if (pinCount.current === 0) {
      setTimeout(() => {
        if (!isHovered.current && !ref.current?.contains(document.activeElement)) setIsActive(false);
      }, 0);
    }
  }, []);

  const handlers = {
    onMouseEnter: () => {
      isHovered.current = true;
      setIsActive(true);
    },
    // Deliberately NOT sheet-aware, unlike onBlur below: openMobileSheetCount is global, not
    // scoped to this block, so treating a sheet open ANYWHERE as "still active" here would leave
    // an unrelated block's toolbar stuck open too if it was ever hovered (mouse, not touch) while
    // some other block's sheet happened to be open. onBlur doesn't have this problem, since only
    // the block whose OWN field triggered the blur-and-sheet-open ever runs into that timing race.
    onMouseLeave: () => {
      isHovered.current = false;
      if (!ref.current?.contains(document.activeElement) && pinCount.current === 0) setIsActive(false);
    },
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setIsActive(true);
    },
    onBlur: () => {
      blurTimer.current = setTimeout(() => {
        if (!ref.current?.contains(document.activeElement) && openMobileSheetCount === 0 && pinCount.current === 0) {
          setIsActive(false);
        }
      }, 0);
    },
  };

  return { isActive, ref, handlers, pin };
}

/** Provided by DraggableBlock around its toolbar: a toolbar control that opens a portaled popover or
 * modal (the bullet AI menu) calls it with true while that is open, false when it closes. */
export const BlockPinContext = createContext<((pinned: boolean) => void) | null>(null);

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
  suppressToolbar = false,
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
  /** True while a bullet's own text-selection format toolbar (BulletFormatToolbar) is up for this
   * block - hides this structural toolbar so the two are never both on screen at once, rather than
   * trying to position them to avoid each other (see BulletList's onSelectionActiveChange wiring
   * and BulletFormatToolbar's own comment for the full reasoning). */
  suppressToolbar?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { isActive, ref: activeRef, handlers, pin } = useBlockActive();
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
  const showToolbar = (selected ?? (gate === null ? isActive : isActive && gate)) && !hasActiveDescendant && !suppressToolbar;

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
        <BlockPinContext.Provider value={pin}>
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
        </BlockPinContext.Provider>
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

/** One flat, non-overlapping slice of a bullet's plain text, ready to render as a single DOM node:
 * bold/italic runs (see lib/resume/bulletMarkup.ts) further split wherever a review-passage
 * boundary falls inside one, so bold/italic and passage highlighting can coexist on the same text
 * without either needing to know about the other. */
interface BulletSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  passage: ReviewPassage | null;
  active: boolean;
}

function bulletSegments(value: string, passages: ReviewPassage[], selectedItemId: string | null): BulletSegment[] {
  const segs: BulletSegment[] = [];
  let plainPos = 0;
  for (const run of parseBulletMarkup(value)) {
    const runStart = plainPos;
    const runEnd = plainPos + run.text.length;
    const cuts = new Set<number>();
    for (const p of passages) {
      if (p.start > runStart && p.start < runEnd) cuts.add(p.start);
      if (p.end > runStart && p.end < runEnd) cuts.add(p.end);
    }
    const bounds = [runStart, ...Array.from(cuts).sort((a, b) => a - b), runEnd];
    for (let i = 0; i < bounds.length - 1; i++) {
      const s = bounds[i];
      const e = bounds[i + 1];
      if (s === e) continue;
      const passage = passages.find((p) => s >= p.start && e <= p.end) ?? null;
      segs.push({
        text: run.text.slice(s - runStart, e - runStart),
        bold: run.bold,
        italic: run.italic,
        passage,
        active: passage ? passage.itemIds.includes(selectedItemId ?? "") : false,
      });
    }
    plainPos = runEnd;
  }
  return segs;
}

/** Rebuilds the contentEditable's actual child nodes from the stored marked-up string - the
 * "value -> DOM" direction. A segment with neither bold/italic/passage is a bare text node (same
 * as before this feature existed); a formatted and/or highlighted one is a single element (never
 * nested wrappers) carrying data-bold/data-italic so domToMarkup below can read the state straight
 * back off it, plus data-review-passage when it's also a review highlight. Always a full rebuild,
 * never a diff - only called when the incoming value did NOT originate from this element's own
 * last edit (see EditableBullet's lastEmittedRef), so it never runs mid-keystroke. */
function renderBulletDom(root: HTMLElement, value: string, passages: ReviewPassage[], selectedItemId: string | null) {
  root.textContent = "";
  for (const seg of bulletSegments(value, passages, selectedItemId)) {
    if (!seg.bold && !seg.italic && !seg.passage) {
      root.appendChild(document.createTextNode(seg.text));
      continue;
    }
    const el = document.createElement(seg.passage ? "mark" : "span");
    el.textContent = seg.text;
    if (seg.bold) {
      el.dataset.bold = "1";
      el.style.fontWeight = "700";
    }
    if (seg.italic) {
      el.dataset.italic = "1";
      el.style.fontStyle = "italic";
    }
    if (seg.passage) {
      el.dataset.reviewPassage = seg.passage.itemIds[0];
      Object.assign(el.style, passageStyle(seg.passage, seg.active));
    }
    root.appendChild(el);
  }
}

/** The reverse direction: reads the contentEditable's current (possibly just hand-edited-by-the-
 * browser) DOM back into the stored marked-up string. Checks each direct child's own computed
 * fontWeight/fontStyle as a fallback alongside its data-bold/data-italic attribute, since a
 * browser's native contentEditable typing can occasionally clone inline style onto a freshly-split
 * text node at a formatting boundary without copying custom data attributes - the computed-style
 * check catches that case too, rather than silently losing the format at a boundary. */
function domToMarkup(root: HTMLElement): string {
  const runs: BulletRun[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push({ text: node.textContent ?? "", bold: false, italic: false });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const bold = node.dataset.bold === "1" || node.style.fontWeight === "700" || node.style.fontWeight === "bold";
    const italic = node.dataset.italic === "1" || node.style.fontStyle === "italic";
    runs.push({ text: node.textContent ?? "", bold, italic });
  });
  return serializeBulletRuns(runs);
}

/** Walks the same direct children domToMarkup does, summing plain-text length, to convert a live
 * DOM Range boundary (container/offset) into a plain-text offset - the coordinate space
 * insertMarkupAroundSelection and the review pipeline both work in. Returns null if `node` isn't
 * inside `root` at all (defensive; callers only invoke this for a selection already confirmed to
 * be inside the bullet). */
function rangeBoundaryToPlainOffset(root: HTMLElement, node: Node, offset: number): number | null {
  if (!root.contains(node)) return null;
  // The boundary's own top-level ancestor under root (a direct child of root, or root itself if
  // the Range boundary is root with a childNodes-index offset rather than inside a text node).
  let plainPos = 0;
  for (const child of Array.from(root.childNodes)) {
    if (child === node || child.contains(node)) {
      // offset is a character offset within a text node, or a child-index within an element - the
      // latter only ever being the boundary's own container (never a deeper descendant, since
      // renderBulletDom never creates more than one level), so it's 0 (before the wrapper's single
      // text child) or 1 (after it), not the wrapper's text length regardless of which.
      const within = node.nodeType === Node.TEXT_NODE ? offset : offset > 0 ? (node.textContent ?? "").length : 0;
      return plainPos + Math.min(within, (child.textContent ?? "").length);
    }
    plainPos += (child.textContent ?? "").length;
  }
  if (node === root) {
    // offset is a childNodes index directly on root (e.g. clicking into empty space at the end).
    let pos = 0;
    for (let i = 0; i < offset && i < root.childNodes.length; i++) pos += (root.childNodes[i].textContent ?? "").length;
    return pos;
  }
  return null;
}

/** The inverse: places the browser Selection over a plain-text offset range inside root, by
 * walking direct children (same traversal as domToMarkup/rangeBoundaryToPlainOffset) to find which
 * child (and how far into its text) each plain offset lands on. Used to restore the visible
 * selection after a Bold/Italic click rebuilds the DOM out from under the old Range. */
function setSelectionByPlainOffsets(root: HTMLElement, start: number, end: number) {
  const locate = (plainOffset: number): { node: Node; offset: number } => {
    let pos = 0;
    for (const child of Array.from(root.childNodes)) {
      const len = (child.textContent ?? "").length;
      if (plainOffset <= pos + len) {
        const within = plainOffset - pos;
        // A text node takes a character offset directly; an element wrapper takes a childNodes
        // index - descend into its own (single) text node to get a character-offset target.
        if (child.nodeType === Node.TEXT_NODE) return { node: child, offset: within };
        const inner = child.firstChild;
        return inner ? { node: inner, offset: Math.min(within, (inner.textContent ?? "").length) } : { node: child, offset: 0 };
      }
      pos += len;
    }
    return { node: root, offset: root.childNodes.length };
  };
  const sel = window.getSelection();
  if (!sel) return;
  const range = document.createRange();
  const from = locate(start);
  const to = locate(end);
  range.setStart(from.node, from.offset);
  range.setEnd(to.node, to.offset);
  sel.removeAllRanges();
  sel.addRange(range);
}

/**
 * The WYSIWYG bullet leaf: a contentEditable div, scoped to bullets only (every other field stays
 * on EditableField's native input/textarea) - true inline bold/italic can't be shown in a
 * textarea, only contentEditable supports mixed formatting within one line. Auto-grows for free
 * (no scrollHeight trick needed, unlike EditableField's textarea).
 *
 * The stored value is still one plain string with embedded markers (lib/resume/bulletMarkup.ts) -
 * this component is the only place that turns it into live, styled DOM and back. Controlled-
 * contentEditable's classic hazard: naively re-rendering the DOM from `value` on every keystroke
 * clobbers the caret/IME composition state, since the browser already applied the keystroke to the
 * live DOM itself before onInput even fires. lastEmittedRef records the last string THIS element
 * itself produced; renderBulletDom only runs when the incoming value differs from that (i.e. it
 * changed for some other reason - History undo/redo, an AI-assist accept, the Bold/Italic toolbar) -
 * never as a reaction to this element's own typing.
 */
function EditableBullet({
  value,
  onChange,
  onBlur,
  targetKey,
  ariaLabel,
  onSelectionActiveChange,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  targetKey?: string;
  ariaLabel?: string;
  /** Fires true while this bullet has a non-collapsed text selection, false once it collapses/the
   * field blurs - DraggableBlock uses this to hide its own structural toolbar for this block while
   * the format toolbar owns the moment (see BulletFormatToolbar's own top comment for why the two
   * never both show at once). */
  onSelectionActiveChange?: (active: boolean) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastEmittedRef = useRef<string | null>(null);
  /** Set right before a Bold/Italic click's onChange, so the post-rebuild layout effect knows to
   * restore the (still-selected) plain-text range once the new DOM exists - a toolbar click, unlike
   * typing, needs the DOM rebuilt (it never directly touched the live DOM itself), so this is
   * deliberately NOT the same lastEmittedRef "skip the rebuild" path typing uses. */
  const pendingRestoreRef = useRef<{ start: number; end: number } | null>(null);
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selection, setSelection] = useState<{ start: number; end: number; rect: DOMRect } | null>(null);
  const { passages, selectedItemId, onSelectItem } = useContext(ReviewHighlightContext);
  const plainLength = useMemo(() => stripBulletMarkup(value).length, [value]);
  const fieldPassages = useMemo(
    () =>
      (targetKey ? passages.get(targetKey) ?? [] : [])
        .filter((p) => p.start < plainLength)
        .map((p) => ({ ...p, end: Math.min(p.end, plainLength) })),
    [passages, targetKey, plainLength]
  );
  // ReviewHighlightContext's passages Map gets a new reference (and fieldPassages a new array)
  // whenever ANY bullet's review state changes, not just this one's - a content signature (rather
  // than comparing fieldPassages by reference) is what actually tells this bullet whether its own
  // highlighting changed, so a rebuild isn't skipped when it should still repaint (stale highlight)
  // and isn't forced when this bullet's own passages/selection didn't actually change (redundant
  // rebuild for every other bullet on the page).
  const passageSignature = useMemo(
    () => fieldPassages.map((p) => `${p.start}:${p.end}:${p.severity}:${p.itemIds.join(",")}`).join("|"),
    [fieldPassages]
  );
  const lastRenderedSignatureRef = useRef<string | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const signature = `${selectedItemId ?? ""}::${passageSignature}`;
    if (lastEmittedRef.current === value && lastRenderedSignatureRef.current === signature) return;
    lastRenderedSignatureRef.current = signature;
    renderBulletDom(root, value, fieldPassages, selectedItemId);
    const pending = pendingRestoreRef.current;
    if (pending) {
      pendingRestoreRef.current = null;
      setSelectionByPlainOffsets(root, pending.start, pending.end);
      const sel = window.getSelection();
      const rect = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).getBoundingClientRect() : null;
      if (rect) setSelection({ start: pending.start, end: pending.end, rect });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, fieldPassages, selectedItemId, passageSignature]);

  function commit() {
    const root = rootRef.current;
    if (!root) return;
    const next = domToMarkup(root);
    lastEmittedRef.current = next;
    if (next !== value) onChange(next);
  }

  function applyFormat(kind: "bold" | "italic") {
    if (!selection) return;
    const result = insertMarkupAroundSelection(value, selection.start, selection.end, kind);
    pendingRestoreRef.current = { start: result.start, end: result.end };
    onChange(result.text);
  }

  function handleInput() {
    commit();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // A bullet is one line - block a literal newline (block-level <div>/<br> insertion) rather
    // than let the browser create nested structure renderBulletDom/domToMarkup never expects. Not
    // while an IME composition is still open though (nativeEvent.isComposing / the legacy keyCode
    // 229 some browsers still report): that Enter confirms the candidate, it doesn't submit a
    // newline, and preventDefault-ing it can suppress the confirm instead.
    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) e.preventDefault();
  }

  function insertPlainTextAtSelection(text: string) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(text));
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    commit();
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    // Force plain text: pasted rich formatting (e.g. copied from Word) is not something this
    // feature supports preserving, and letting the browser insert arbitrary markup would corrupt
    // domToMarkup's data-bold/data-italic-only model.
    e.preventDefault();
    insertPlainTextAtSelection(e.clipboardData.getData("text/plain"));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    // Same reasoning as handlePaste: a drag carrying rich text (e.g. dropped from Word or another
    // app) bypasses onPaste entirely and would otherwise hit the browser's native contentEditable
    // drop behavior, inserting arbitrary DOM domToMarkup doesn't expect.
    e.preventDefault();
    insertPlainTextAtSelection(e.dataTransfer.getData("text/plain"));
  }

  function handleFocus() {
    if (isMobile) {
      (document.activeElement as HTMLElement | null)?.blur();
      setIsSheetOpen(true);
      return;
    }
    setIsFocused(true);
  }

  function updateSelectionFromDom() {
    const root = rootRef.current;
    const sel = window.getSelection();
    if (!root || !sel || sel.rangeCount === 0 || sel.isCollapsed) {
      setSelection(null);
      onSelectionActiveChange?.(false);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) {
      setSelection(null);
      onSelectionActiveChange?.(false);
      return;
    }
    const start = rangeBoundaryToPlainOffset(root, range.startContainer, range.startOffset);
    const end = rangeBoundaryToPlainOffset(root, range.endContainer, range.endOffset);
    if (start === null || end === null || start === end) {
      setSelection(null);
      onSelectionActiveChange?.(false);
      return;
    }
    setSelection({ start: Math.min(start, end), end: Math.max(start, end), rect: range.getBoundingClientRect() });
    onSelectionActiveChange?.(true);
  }

  // selectionchange (not just mouseup/keyup) so a keyboard-driven selection (Shift+Arrow, Ctrl+A)
  // shows the format toolbar too, not only a mouse drag - only listened for while this bullet has
  // focus, not as a single always-on global listener. Deferred one frame: selectionchange can fire
  // slightly before the browser has settled the new Range on some mouse-drag sequences.
  useEffect(() => {
    if (!isFocused) return;
    let raf = 0;
    const onSelectionChange = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateSelectionFromDom);
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("selectionchange", onSelectionChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    if (isMobile) return;
    const mark = (e.target as HTMLElement).closest("[data-review-passage]");
    if (mark instanceof HTMLElement && mark.dataset.reviewPassage) onSelectItem(mark.dataset.reviewPassage);
  }

  return (
    <>
      <div
        ref={rootRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="false"
        aria-label={ariaLabel}
        data-fc-target={targetKey}
        className="hover:bg-black/[0.035] focus:bg-black/[0.04] focus:outline-none transition-colors"
        style={{ width: "100%", whiteSpace: "pre-wrap", overflowWrap: "break-word", cursor: "text" }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onFocus={handleFocus}
        onBlur={() => {
          setIsFocused(false);
          setSelection(null);
          onSelectionActiveChange?.(false);
          onBlur?.();
        }}
        onClick={handleClick}
      />
      {selection && (
        <BulletFormatToolbar
          anchorRect={selection.rect}
          isBold={isRangeFormatted(value, selection.start, selection.end, "bold")}
          isItalic={isRangeFormatted(value, selection.start, selection.end, "italic")}
          onBold={() => applyFormat("bold")}
          onItalic={() => applyFormat("italic")}
        />
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {isSheetOpen && (
              <MobileFieldSheet
                as="textarea"
                value={value}
                onChange={onChange}
                ariaLabel={ariaLabel}
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
  onSelectionActiveChange,
}: {
  targetKey: string;
  highlight?: "flagged" | "active";
  onActivate?: (targetKey: string, rect: DOMRect) => void;
  as?: "span" | "strong" | "i";
  children: ReactNode;
  /** Renders an EditableField (or, for "contentEditable", EditableBullet) instead of the static
   * tag below - `as`/`children` are ignored in this branch (an input can't be a nested
   * <strong>/<i>; use `inputStyle` for that instead). */
  editable?: boolean;
  /** "contentEditable" is bullets only (see BulletList) - true WYSIWYG bold/italic needs real DOM
   * styling a textarea can't do. Every other field stays "input"/"textarea". */
  editableAs?: "input" | "textarea" | "contentEditable";
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  inputStyle?: CSSProperties;
  ariaLabel?: string;
  /** contentEditable only - see EditableBullet's own doc comment. */
  onSelectionActiveChange?: (active: boolean) => void;
}) {
  if (editable && editableAs === "contentEditable") {
    return (
      <EditableBullet
        value={value ?? ""}
        onChange={onChange ?? (() => {})}
        onBlur={onBlur}
        targetKey={targetKey}
        ariaLabel={ariaLabel}
        onSelectionActiveChange={onSelectionActiveChange}
      />
    );
  }
  if (editable && editableAs !== "contentEditable") {
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
    <div
      ref={rootRef}
      className="group absolute inset-x-0 top-0 z-[2] h-0"
      data-section-insert
      // Tabbing away closes the pill, the way a click elsewhere does.
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-0.5 -translate-y-1/2 bg-accent transition-opacity duration-fast ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />
      <div className="absolute left-1/2 top-0 flex -translate-x-1/2 -translate-y-[calc(100%-4px)] items-center">
        {/* One button that changes shape, not two, so keyboard focus stays on it when it opens. */}
        <button
          type="button"
          aria-label={open ? undefined : `${label} at the top of this section`}
          title={open ? undefined : `${label} at the top`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            if (!open) return setOpen(true);
            setOpen(false);
            onInsert();
          }}
          className={`inline-flex items-center justify-center rounded-full border border-accent bg-white text-accent shadow-sm hover:bg-accent-soft ${ring} ${
            open ? "h-6 gap-1 whitespace-nowrap px-2.5 font-sans text-[11px] font-semibold leading-none" : "h-5 w-5 transition-transform duration-fast hover:scale-110"
          }`}
        >
          <PlusIcon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
          {open && label}
        </button>
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

/** Renders a bullet's bold/italic runs (see lib/resume/bulletMarkup.ts) as real <strong>/<em>
 * nodes, for the static/read-only render path - the same one PDF export renders via
 * renderToStaticMarkup (lib/pdf/renderResumeMarkup.tsx), so this one change is what every
 * template's exported PDF produces, with no per-template work. A bold+italic run nests <em>
 * inside <strong>. Plain text renders as a bare string, matching what {bullet} used to render
 * directly before this existed. */
function renderBulletRuns(text: string): ReactNode {
  return parseBulletMarkup(text).map((run, i) => {
    let node: ReactNode = run.text;
    if (run.italic) node = <em key="i">{node}</em>;
    if (run.bold) node = <strong key="b">{node}</strong>;
    return <Fragment key={i}>{node}</Fragment>;
  });
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
  // Which bullet (by index) currently has an active text selection - at most one, since only one
  // contentEditable can hold a live selection at a time. Drives that one bullet's suppressToolbar
  // (see DraggableBlock) so its structural toolbar and its BulletFormatToolbar never both show.
  const [selectionActiveIndex, setSelectionActiveIndex] = useState<number | null>(null);

  if (!editable) {
    return (
      <ul style={style.bulletList}>
        {bullets.map((bullet, j) => {
          const key = factCheckTargetKey({ kind: targetKind, index: entryIndex, bulletIndex: j });
          return (
            <li key={j} style={style.bullet}>
              <span aria-hidden="true">• </span>
              <HighlightSpan targetKey={key} highlight={highlights[key]} onActivate={onHighlightActivate}>
                {renderBulletRuns(bullet)}
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
                suppressToolbar={selectionActiveIndex === j}
              >
                <span aria-hidden="true">• </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <HighlightSpan
                    targetKey={key}
                    highlight={highlights[key]}
                    onActivate={onHighlightActivate}
                    editable
                    editableAs="contentEditable"
                    value={bullet}
                    onChange={(value) => onBulletChange?.(j, value)}
                    onBlur={onBulletBlur}
                    ariaLabel="Bullet point"
                    onSelectionActiveChange={(active) => setSelectionActiveIndex((prev) => (active ? j : prev === j ? null : prev))}
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

