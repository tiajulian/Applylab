"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircleIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@/components/ui/icons/LucideIcons";
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
  style,
  targetKind,
  entryIndex,
  highlights,
  onHighlightActivate,
  editable,
  onBulletChange,
  onBulletBlur,
  onBulletRemove,
  onBulletMove,
  renderBulletExtra,
}: {
  bullets: string[];
  style: Record<string, CSSProperties>;
  targetKind: "experienceBullet" | "projectBullet";
  entryIndex: number;
  highlights: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
  editable?: boolean;
  onBulletChange?: (bulletIndex: number, value: string) => void;
  onBulletBlur?: () => void;
  onBulletRemove?: (bulletIndex: number) => void;
  onBulletMove?: (bulletIndex: number, direction: -1 | 1) => void;
  /** Slot for a caller-supplied extra control per bullet (e.g. the canvas's AI-assist trigger) -
   * BulletList stays domain-agnostic (no resumeId/AI-endpoint knowledge) by not owning this itself. */
  renderBulletExtra?: (bulletIndex: number) => ReactNode;
}) {
  return (
    <ul style={style.bulletList}>
      {bullets.map((bullet, j) => {
        const key = factCheckTargetKey({ kind: targetKind, index: entryIndex, bulletIndex: j });
        if (!editable) {
          return (
            <li key={j} style={style.bullet}>
              <span aria-hidden="true">• </span>
              <HighlightSpan targetKey={key} highlight={highlights[key]} onActivate={onHighlightActivate}>
                {bullet}
              </HighlightSpan>
            </li>
          );
        }
        return (
          <li key={j} style={{ ...style.bullet, display: "flex", alignItems: "flex-start", gap: "4px" }}>
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
            <div style={{ display: "flex", alignItems: "center", gap: "2px", flexShrink: 0 }} className="print:hidden">
              {renderBulletExtra?.(j)}
              <button
                type="button"
                aria-label="Move bullet up"
                disabled={j === 0}
                onClick={() => onBulletMove?.(j, -1)}
                style={{ opacity: j === 0 ? 0.25 : 1, cursor: j === 0 ? "not-allowed" : "pointer" }}
              >
                <ArrowUpIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
              </button>
              <button
                type="button"
                aria-label="Move bullet down"
                disabled={j === bullets.length - 1}
                onClick={() => onBulletMove?.(j, 1)}
                style={{ opacity: j === bullets.length - 1 ? 0.25 : 1, cursor: j === bullets.length - 1 ? "not-allowed" : "pointer" }}
              >
                <ArrowDownIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
              </button>
              <button type="button" aria-label="Remove bullet" onClick={() => onBulletRemove?.(j)}>
                <TrashIcon style={{ width: "0.85em", height: "0.85em" }} strokeWidth={2.75} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
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
