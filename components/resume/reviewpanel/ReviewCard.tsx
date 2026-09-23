"use client";

import { forwardRef, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CheckCircleIcon, CheckIcon, ChevronDownIcon, CircleIcon, InfoIcon, LightbulbIcon, PencilIcon, UndoIcon,
} from "@/components/ui/icons/LucideIcons";
import { actionLabels, sectionLabel, trustLine, type TrustTone } from "@/lib/review/copy";
import { buildComparison, diffWords } from "@/lib/review/diff";
import { stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import type { ReviewEntry } from "@/lib/review/progress";
import { WordDiff } from "./WordDiff";

const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring";
const button = `inline-flex min-h-[var(--rp-target)] items-center justify-center gap-2 rounded-lg px-4 text-[length:var(--rp-text)] font-semibold transition-colors ${focusRing}`;
const primary = `${button} border border-accent bg-accent text-on-accent hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50`;
const secondary = `${button} border border-border-strong bg-surface text-ink hover:bg-paper-deep`;
const tertiary = `inline-flex min-h-[var(--rp-target)] items-center gap-1.5 rounded-lg px-2 text-[length:var(--rp-text)] font-semibold text-ink-secondary underline-offset-2 hover:text-ink hover:underline ${focusRing}`;

const TRUST_STYLE: Record<TrustTone, { box: string; icon: (props: { className: string }) => ReactNode }> = {
  safe: { box: "bg-success-soft text-success", icon: (p) => <CheckCircleIcon {...p} strokeWidth={2} aria-hidden="true" /> },
  verify: { box: "bg-attention-soft text-attention", icon: (p) => <InfoIcon {...p} strokeWidth={2} aria-hidden="true" /> },
  fix: { box: "bg-info-soft text-info", icon: (p) => <LightbulbIcon {...p} strokeWidth={2} aria-hidden="true" /> },
};

function TrustChip({ tone, text }: { tone: TrustTone; text: string }) {
  const { box, icon } = TRUST_STYLE[tone];
  return (
    <p className={`flex items-start gap-2 rounded-lg px-[var(--rp-block)] py-[var(--rp-chipy)] text-[length:var(--rp-text)] font-medium leading-[var(--rp-leading)] ${box}`}>
      {icon({ className: "mt-0.5 h-4 w-4 shrink-0" })}
      <span>{text}</span>
    </p>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "verify" | "muted" }) {
  const style = tone === "verify" ? "border-attention/40 bg-attention-soft text-attention" : "border-border-strong bg-paper-deep text-ink-secondary";
  return <span className={`shrink-0 rounded-pill border px-2 py-0.5 text-[length:var(--rp-small)] font-semibold ${style}`}>{children}</span>;
}

/** The line a collapsed or done row shows: the wording as it stands on the resume (or, for an open rewrite, as suggested). */
function snippetOf({ item, state }: ReviewEntry, blockText: string): string {
  if (item.kind === "fix") return blockText || item.before;
  if (state === "kept") return item.before || blockText;
  return state === "accepted" ? blockText || item.after : item.after;
}

export interface ReviewCardProps {
  entry: ReviewEntry;
  /** "Experience, Analytics Engineer" */
  label: string;
  /** The block's text right now. */
  blockText: string;
  expanded: boolean;
  editing: boolean;
  skipped: boolean;
  /** "1 of 5": this card's place among the tab's open cards. */
  place: { index: number; count: number } | null;
  canAccept: boolean;
  canKeep: boolean;
  onExpand: () => void;
  onAccept: () => void;
  onKeep: () => void;
  onSkip: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (text: string) => void;
  onUndo: () => void;
  /** Extra action for old honesty flags: opens the evidence/fix popover. */
  onOpenEvidence?: () => void;
}

export const ReviewCard = forwardRef<HTMLLIElement, ReviewCardProps>(function ReviewCard(props, ref) {
  const { entry, label, blockText, expanded, editing, skipped, place } = props;
  const { item, state } = entry;
  const { full, short } = sectionLabel(label);

  if (state !== "pending") {
    const accepted = state === "accepted";
    return (
      <li ref={ref} data-review-card={item.id} className="flex shrink-0 items-center gap-3 rounded-xl border border-border bg-paper/60 py-1 pl-[var(--rp-pad)] pr-1">
        <CheckCircleIcon className={`h-5 w-5 shrink-0 ${accepted ? "text-success" : "text-ink-muted"}`} strokeWidth={2} aria-hidden="true" />
        <div className="min-w-0 flex-1 py-[var(--rp-chipy)]">
          <p className="text-[length:var(--rp-small)] font-semibold text-ink-secondary">{accepted ? "Accepted" : "Kept original"} · {short}</p>
          <p className="truncate text-[length:var(--rp-text)] text-ink-secondary">{snippetOf(entry, blockText)}</p>
        </div>
        <button type="button" onClick={props.onUndo} className={`${tertiary} shrink-0 px-3`}>
          <UndoIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Undo<span className="sr-only">: {full}</span>
        </button>
      </li>
    );
  }

  if (!expanded) {
    return (
      <li ref={ref} data-review-card={item.id} className="shrink-0">
        <button
          type="button"
          aria-expanded="false"
          onClick={props.onExpand}
          className={`flex min-h-[var(--rp-target)] w-full items-center gap-3 rounded-xl border border-border bg-surface py-[var(--rp-chipy)] px-[var(--rp-pad)] text-left hover:bg-paper-deep ${focusRing}`}
        >
          <CircleIcon className="h-5 w-5 shrink-0 text-border-strong" strokeWidth={2} aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[length:var(--rp-small)] font-semibold text-ink-secondary">{full}</span>
            <span className="block truncate text-[length:var(--rp-text)] text-ink">{snippetOf(entry, blockText)}</span>
          </span>
          {item.severity === "verify" && <Pill tone="verify">Verify</Pill>}
          {skipped && <Pill tone="muted">Skipped</Pill>}
          <ChevronDownIcon className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={2} aria-hidden="true" />
        </button>
      </li>
    );
  }

  return (
    <li
      ref={ref}
      tabIndex={-1}
      data-review-card={item.id}
      aria-current="true"
      className="flex shrink-0 flex-col gap-[var(--rp-gap)] rounded-xl border border-accent/60 bg-surface p-[var(--rp-pad)] shadow-sm focus:outline-none"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[length:var(--rp-text)] font-semibold text-ink">{full}</h3>
        {place && <span className="shrink-0 text-[length:var(--rp-small)] font-medium text-ink-secondary">{place.index} of {place.count}</span>}
      </div>
      {editing ? <EditForm {...props} /> : <OpenCard {...props} />}
    </li>
  );
});

function OpenCard({ entry, blockText, canAccept, canKeep, onAccept, onKeep, onSkip, onStartEdit, onOpenEvidence }: ReviewCardProps) {
  const { item } = entry;
  const trust = trustLine(item);
  const labels = actionLabels(item);
  const { original, suggested, flagged } = useMemo(() => buildComparison(item, blockText), [item, blockText]);
  // Stripped before diffing (lib/resume/bulletMarkup.ts) - this card is about whether the wording
  // changed, not formatting, and a bare bold/italic marker would otherwise show up as its own
  // one-character insert/delete either side of an otherwise-unchanged word.
  const diff = useMemo(
    () => (suggested === null ? [] : diffWords(stripBulletMarkup(original), stripBulletMarkup(suggested))),
    [original, suggested]
  );

  return (
    <>
      <TrustChip {...trust} />

      {suggested !== null && (
        <div className="rounded-lg bg-success-soft p-[var(--rp-block)]">
          <p className="mb-0.5 text-[length:var(--rp-small)] font-semibold uppercase tracking-wide text-success">Suggested</p>
          <p className="whitespace-pre-wrap break-words text-[length:var(--rp-text)] leading-[var(--rp-leading)] text-ink">
            <WordDiff diff={diff} side="add" />
          </p>
        </div>
      )}
      {original && (
        <div className="rounded-lg border border-border bg-paper-deep/60 p-[var(--rp-block)]">
          <p className="mb-0.5 text-[length:var(--rp-small)] font-semibold uppercase tracking-wide text-ink-secondary">Your original</p>
          <p className="whitespace-pre-wrap break-words text-[length:var(--rp-text)] leading-[var(--rp-leading)] text-ink">
            {suggested !== null ? (
              <WordDiff diff={diff} side="del" />
            ) : flagged ? (
              <>
                {original.slice(0, flagged[0])}
                <mark className="rounded-sm bg-attention/20 font-bold text-ink underline decoration-2 underline-offset-2">{original.slice(...flagged)}</mark>
                {original.slice(flagged[1])}
              </>
            ) : (
              original
            )}
          </p>
        </div>
      )}

      {(canAccept || canKeep) && (
        <div className="flex gap-[var(--rp-listgap)]">
          {canAccept && (
            <button type="button" onClick={onAccept} className={`${primary} flex-1`}>
              <CheckIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              {labels.accept}
            </button>
          )}
          {canKeep && (
            <button type="button" onClick={onKeep} className={`${secondary} flex-1`}>
              {labels.keep}
            </button>
          )}
        </div>
      )}
      <div className="-mx-2 -mb-2 flex flex-wrap items-center gap-x-2">
        <button type="button" onClick={onStartEdit} className={tertiary}>
          <PencilIcon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          Edit wording
        </button>
        <button type="button" onClick={onSkip} className={tertiary}>
          Decide later
        </button>
        {onOpenEvidence && (
          <button type="button" onClick={onOpenEvidence} className={tertiary}>
            Add evidence
          </button>
        )}
      </div>
    </>
  );
}

function EditForm({ entry, blockText, onSaveEdit, onCancelEdit }: ReviewCardProps) {
  const { item } = entry;
  const { original, suggested } = useMemo(() => buildComparison(item, blockText), [item, blockText]);
  const [value, setValue] = useState(suggested ?? original);
  const ref = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const canSave = value.trim().length > 0;

  useEffect(() => {
    const el = ref.current;
    el?.focus();
    el?.setSelectionRange(el.value.length, el.value.length);
  }, []);

  function save() {
    if (canSave) onSaveEdit(value.trim());
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-[length:var(--rp-text)] font-semibold text-ink">Edit wording</label>
        <textarea
          id={id}
          ref={ref}
          value={value}
          rows={6}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // The panel closes on Escape; inside the editor it only cancels the edit.
            if (e.key === "Escape") {
              e.stopPropagation();
              onCancelEdit();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              save();
            }
          }}
          className={`w-full resize-y rounded-lg border border-border-strong bg-surface p-[var(--rp-block)] text-base leading-[var(--rp-leading)] md:text-[length:var(--rp-text)] text-ink ${focusRing}`}
        />
        <p className="text-[length:var(--rp-small)] text-ink-secondary">Nothing changes on your resume until you save.</p>
      </div>
      <div className="flex gap-[var(--rp-listgap)]">
        <button type="button" onClick={save} disabled={!canSave} className={`${primary} flex-1`}>
          <CheckIcon className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
          Save and accept
        </button>
        <button type="button" onClick={onCancelEdit} className={`${secondary} flex-1`}>
          Cancel
        </button>
      </div>
    </>
  );
}
