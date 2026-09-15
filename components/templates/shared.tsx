"use client";

import {
  useCallback,
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
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertCircleIcon, GripVerticalIcon, TrashIcon } from "@/components/ui/icons/LucideIcons";
import { useIsMobile } from "@/lib/hooks/useIsMobile";
import { factCheckTargetKey } from "@/types";

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

/** Tracks whether a block should show its floating toolbar: true while the pointer is over it, OR
 * while focus is anywhere inside it (so keyboard/touch users - who have no hover state - can still
 * reach the toolbar by tabbing/tapping into a field). A block-level onBlur fires even when focus is
 * only moving between two fields inside the SAME block, so it's deferred one tick and re-checked
 * against document.activeElement before actually closing. */
export function useBlockActive() {
  const [isActive, setIsActive] = useState(false);
  const ref = useRef<HTMLElement | null>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlers = {
    onMouseEnter: () => setIsActive(true),
    onMouseLeave: () => {
      if (!ref.current?.contains(document.activeElement)) setIsActive(false);
    },
    onFocus: () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
      setIsActive(true);
    },
    onBlur: () => {
      blurTimer.current = setTimeout(() => {
        if (!ref.current?.contains(document.activeElement)) setIsActive(false);
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
 * button), with a FloatingToolbar (drag handle, remove, optional extra content e.g. the AI-assist
 * trigger) that only appears on hover/focus. Deliberately no visible chrome at rest, unlike this
 * component's predecessor which stamped icons permanently into the resume content - see the Phase 2
 * cutover-review feedback this replaced.
 */
export function DraggableBlock({
  id,
  as = "div",
  style,
  removeLabel,
  onRemove,
  extra,
  children,
}: {
  id: string;
  as?: "div" | "li";
  style?: CSSProperties;
  removeLabel: string;
  onRemove: () => void;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const { isActive, ref: activeRef, handlers } = useBlockActive();

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

  const Tag = as as "div";

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
      {children}
      {isActive && (
        <FloatingToolbar anchorRef={activeRef}>
          <button
            type="button"
            aria-label="Drag to reorder"
            style={{ ...toolbarButtonStyle, cursor: "grab", touchAction: "none" }}
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon style={{ width: "14px", height: "14px" }} strokeWidth={2.5} />
          </button>
          {extra}
          <button type="button" aria-label={removeLabel} onClick={onRemove} style={toolbarButtonStyle}>
            <TrashIcon style={{ width: "14px", height: "14px" }} strokeWidth={2.5} />
          </button>
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
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

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
    background: "transparent",
    margin: 0,
    padding: 0,
    width: "100%",
    color: "inherit",
    font: "inherit",
    lineHeight: "inherit",
    display: "block",
  };
  const mergedStyle: CSSProperties = {
    ...resetStyle,
    ...style,
    ...(highlight ? HIGHLIGHT_STYLE[highlight] : null),
    ...inputStyle,
  };

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
        highlight={highlight}
        onHighlightActivate={onActivate}
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
          value={tool}
          onChange={onChange}
          onBlur={onBlur}
          ariaLabel="Tool category"
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
