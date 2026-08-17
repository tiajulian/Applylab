import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { factCheckTargetKey } from "@/types";

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
}: {
  targetKey: string;
  highlight?: "flagged" | "active";
  onActivate?: (targetKey: string, rect: DOMRect) => void;
  as?: "span" | "strong" | "i";
  children: ReactNode;
}) {
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
        textUnderlineOffset: "3px",
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
}: {
  bullets: string[];
  style: Record<string, CSSProperties>;
  targetKind: "experienceBullet" | "projectBullet";
  entryIndex: number;
  highlights: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
}) {
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

export function ToolRow({
  tool,
  index,
  style,
  labelStyle,
  highlights,
  onHighlightActivate,
}: {
  tool: string;
  index: number;
  style: CSSProperties;
  labelStyle?: CSSProperties;
  highlights: Record<string, "flagged" | "active">;
  onHighlightActivate?: (targetKey: string, rect: DOMRect) => void;
}) {
  const key = factCheckTargetKey({ kind: "tool", index });
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
