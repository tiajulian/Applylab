"use client";

import {
  useLayoutEffect,
  useRef,
  type ChangeEvent,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { AlertCircleIcon, ArrowDownIcon, ArrowUpIcon, TrashIcon } from "@/components/ui/icons/LucideIcons";
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

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

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
          onBlur={onBlur}
        />
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
            <div style={{ display: "flex", gap: "2px", flexShrink: 0 }} className="print:hidden">
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
