"use client";

import { forwardRef, type ReactNode } from "react";
import { contextSnippet } from "@/lib/review/snippet";
import type { ReviewItem, ReviewProvenance } from "@/lib/review/types";

const PROVENANCE_LABEL: Record<ReviewProvenance, string> = {
  profile: "From your profile",
  reworded: "Reworded",
  new_claim: "New claim: verify",
};

const buttonBase =
  "rounded border px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary = `${buttonBase} border-accent bg-accent text-on-accent hover:bg-accent-hover`;
const secondary = `${buttonBase} border-border bg-surface text-ink hover:bg-paper-deep`;

/** The affected words, emphasised with bold + underline rather than colour alone. */
function Emphasis({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-ink underline decoration-2 underline-offset-2">{children}</strong>;
}

function Affected({ item, text }: { item: ReviewItem; text: string }) {
  // The card is built from the last analysis; if the text has since moved on, show the stored words as-is.
  const inPlace = item.kind === "fix" ? text.slice(item.start, item.end) === item.before : text === item.after && item.end > item.start;
  const snippet = inPlace ? contextSnippet(text, item.start, item.end) : null;

  if (item.kind === "fix") {
    return (
      <p className="text-sm text-ink">
        {snippet ? (
          <>
            {snippet.prefix}
            <del className="text-ink-secondary"><Emphasis>{snippet.match}</Emphasis></del>
            {item.after && (
              <>
                {" "}
                <span className="sr-only">replace with</span>
                <span aria-hidden="true">→</span> <ins className="no-underline"><Emphasis>{item.after}</Emphasis></ins>
              </>
            )}
            {snippet.suffix}
          </>
        ) : (
          <Emphasis>{item.before}</Emphasis>
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1 text-sm text-ink">
      {item.before && (
        <p>
          <span className="text-xs font-semibold text-ink-secondary">Your profile: </span>
          {item.before}
        </p>
      )}
      <p>
        <span className="text-xs font-semibold text-ink-secondary">{item.before ? "Resume: " : "Resume text: "}</span>
        {snippet && item.provenance === "new_claim" ? (
          <>
            {snippet.prefix}
            <Emphasis>{snippet.match}</Emphasis>
            {snippet.suffix}
          </>
        ) : (
          item.after.length > 160 ? `${item.after.slice(0, 160)}…` : item.after
        )}
      </p>
    </div>
  );
}

export const ReviewCard = forwardRef<
  HTMLLIElement,
  {
    item: ReviewItem;
    label: string;
    text: string;
    selected: boolean;
    canAccept: boolean;
    canRevert: boolean;
    onSelect: () => void;
    onAccept: () => void;
    onEdit: () => void;
    onDismiss: () => void;
    onRevert: () => void;
    onRestore: () => void;
    /** Extra action for old honesty flags: opens the evidence/fix popover. */
    onOpenEvidence?: () => void;
  }
>(function ReviewCard({ item, label, text, selected, canAccept, canRevert, onSelect, onAccept, onEdit, onDismiss, onRevert, onRestore, onOpenEvidence }, ref) {
  const dismissed = item.status === "dismissed";
  return (
    <li
      ref={ref}
      tabIndex={-1}
      data-review-card={item.id}
      aria-current={selected ? "true" : undefined}
      onClick={onSelect}
      className={`flex flex-col gap-2 rounded-lg border p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "border-accent bg-accent-soft/40" : "border-border bg-surface"
      }`}
    >
      <p className="text-xs font-semibold text-ink-secondary">
        {item.kind === "fix" ? "Fix" : "Change"} - {label}
      </p>
      <Affected item={item} text={text} />
      <p className="text-sm text-ink">{item.reason}</p>
      {item.kind === "change" && item.provenance && (
        <p className="text-xs font-semibold text-ink">{PROVENANCE_LABEL[item.provenance]}</p>
      )}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {dismissed ? (
          <button type="button" className={secondary} onClick={(e) => { e.stopPropagation(); onRestore(); }}>
            Restore
          </button>
        ) : (
          <>
            {canAccept && (
              <button type="button" className={primary} onClick={(e) => { e.stopPropagation(); onAccept(); }}>
                {item.kind === "fix" ? "Fix" : "Accept"}
              </button>
            )}
            <button type="button" className={secondary} onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              Edit
            </button>
            <button type="button" className={secondary} onClick={(e) => { e.stopPropagation(); onDismiss(); }}>
              Dismiss
            </button>
            {canRevert && (
              <button type="button" className={secondary} onClick={(e) => { e.stopPropagation(); onRevert(); }}>
                Revert
              </button>
            )}
            {onOpenEvidence && (
              <button type="button" className={secondary} onClick={(e) => { e.stopPropagation(); onOpenEvidence(); }}>
                Add evidence
              </button>
            )}
          </>
        )}
      </div>
    </li>
  );
});
