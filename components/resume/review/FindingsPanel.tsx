"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fillInPlaceholders, hasFillInPlaceholder } from "@/lib/resume/placeholders";
import { blankQuestion, findingField, suggestedReplacement, type ActionableFinding, type ReviewAction } from "@/lib/resume/reviewActions";
import { diffWords } from "@/lib/review/diff";
import { WordDiff } from "@/components/resume/reviewpanel/WordDiff";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { REVIEW_CATEGORIES } from "./reviewCategories";
import { LockIcon, CheckIcon } from "./icons";
import { ChevronDownIcon } from "@/components/ui/icons/LucideIcons";
import { confirmedSkillEvidence, skillGapRole, type ReviewSkillGap } from "@/lib/resume/reviewSkillGap";
import type { ResumeContent, ResumeReviewFinding } from "@/types";

interface FindingsPanelProps {
  skillGap?: ReviewSkillGap | null;
  findings: ResumeReviewFinding[];
  content: ResumeContent | null;
  resumeId: string;
  unlocked: boolean;
  onAction: (finding: ResumeReviewFinding, action: ReviewAction, fixText?: string, expectedText?: string) => Promise<void>;
  applyingFindingId: string | null;
  onDraftChange?: (findingId: string, dirty: boolean) => void;
}

const SEVERITY_ORDER: Record<ResumeReviewFinding["severity"], number> = { hard_fail: 0, warning: 1, info: 2 };

export function isOpenFinding(finding: ResumeReviewFinding) {
  return finding.status !== "applied" && finding.status !== "dismissed";
}

export function FindingsPanel({ findings, content, resumeId, unlocked, onAction, applyingFindingId, onDraftChange, skillGap }: FindingsPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const router = useRouter();
  const sorted = [...findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const groups = [
    { title: "Fix first", items: sorted.filter((f) => f.severity !== "info") },
    { title: "Nice to have", items: sorted.filter((f) => f.severity === "info") },
  ].filter((g) => g.items.length > 0);

  return (
    <section className="flex flex-col gap-4" aria-labelledby="findings-heading">
      <div>
        <h2 id="findings-heading" className="font-display text-h3 font-semibold text-ink">What to improve</h2>
        {unlocked && findings.some(isOpenFinding) && (
          <p className="mt-1 text-sm text-ink-secondary">Open a suggestion to compare the wording. You choose what changes, and you can undo it.</p>
        )}
      </div>
      {findings.length === 0 && <Card className="p-6 text-center text-sm text-ink-secondary">No specific suggestions this time.</Card>}
      {!unlocked && findings.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-ink">
            <LockIcon className="h-4 w-4 flex-shrink-0 text-accent" />
            See why each suggestion matters and preview changes before applying them.
          </p>
          <Button type="button" onClick={() => router.push("/upgrade")}>Unlock fixes</Button>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
            {group.title} · {group.items.filter(isOpenFinding).length} left
          </h3>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {group.items.map((finding) => (
              <FindingItem key={finding.id} finding={finding} content={content} resumeId={resumeId}
                open={openId === finding.id} onOpenChange={(open) => setOpenId(open ? finding.id : null)}
                evidence={content && finding.target?.kind === "experienceBullet" ? (skillGap?.items ?? [])
                  .filter((item) => finding.target?.kind === "experienceBullet" && skillGapRole(content, item) === finding.target.index)
                  .flatMap((item) => { const text = confirmedSkillEvidence(item); return text ? [text] : []; }) : []}
                unlocked={unlocked} busy={applyingFindingId !== null}
                isApplying={applyingFindingId === finding.id} onAction={onAction} onDraftChange={onDraftChange} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function FindingItem({ finding, content, resumeId, unlocked, busy, isApplying, onAction, onDraftChange, open, onOpenChange, evidence }: {
  evidence: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finding: ActionableFinding;
  content: ResumeContent | null;
  resumeId: string;
  unlocked: boolean;
  busy: boolean;
  isApplying: boolean;
  onAction: FindingsPanelProps["onAction"];
  onDraftChange: FindingsPanelProps["onDraftChange"];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ReviewAction | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const done = !isOpenFinding(finding);
  const currentField = content ? findingField(content, finding) : null;
  const draftField = useRef<ReturnType<typeof findingField>>(null);
  const field = hasDraft ? draftField.current ?? currentField : currentField;
  const outdated = Boolean(hasDraft && field && (currentField?.id !== field.id || currentField?.text !== field.text));
  const replacement = suggestedReplacement(finding);
  const bodyId = 'finding-body-' + finding.id;
  const canUndo = finding.status === "dismissed" || Boolean(finding.review_change);
  const meta = [finding.resume_location, REVIEW_CATEGORIES[finding.category_key].label].filter(Boolean).join(" · ");

  async function act(action: ReviewAction, text?: string) {
    setError(null);
    setPendingAction(action);
    try {
      await onAction(finding, action, text, field?.text);
      onDraftChange?.(finding.id, false);
      setHasDraft(false);
      onOpenChange(true);
      trigger.current?.focus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn't save this change. Please try again.");
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <li className="min-w-0" aria-busy={isApplying}>
      <button id={`finding-trigger-${finding.id}`} ref={trigger} type="button" onClick={() => onOpenChange(!open)}
        aria-expanded={unlocked ? open : undefined} aria-controls={unlocked ? bodyId : undefined}
        disabled={!unlocked}
        className="flex min-h-14 w-full items-start gap-3 p-4 text-left hover:bg-paper-deep/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent disabled:cursor-default">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={'break-words text-sm font-semibold ' + (done ? 'text-ink-muted' : 'text-ink')}>{finding.title}</span>
          <span className="text-xs text-ink-muted">{meta}</span>
          {!done && hasDraft && <span className="text-xs font-medium text-attention">Unsaved wording</span>}
          {done && (
            <span className="flex items-center gap-1 text-xs font-medium text-ink-secondary">
              <CheckIcon className="h-3 w-3" />{finding.status === "applied" ? "Change applied" : "Kept yours"}
            </span>
          )}
        </span>
        {unlocked && <ChevronDownIcon aria-hidden="true" className={'mt-0.5 h-4 w-4 shrink-0 text-ink-muted ' + (open ? 'rotate-180' : '')} />}
      </button>
      {/* Keep drafts mounted while a card is closed or a save is retried. */}
      {unlocked && (
        <div id={bodyId} hidden={!open} className="px-4 pb-4">
          {done ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-secondary">{finding.status === "applied" ? "Your change is saved." : "Your wording is unchanged."}</p>
              {canUndo && <Button variant="outline" disabled={busy} isLoading={isApplying} onClick={() => act("undo")}>Undo</Button>}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {finding.detail && <p className="text-sm leading-relaxed text-ink-secondary">{finding.detail}</p>}
              {field ? (
                <FindingRewrite key={field.id + ':' + field.text} finding={finding} original={field.text}
                  outdated={outdated}
                  dirty={hasDraft}
                  evidence={evidence}
                  replacement={replacement} busy={busy} isApplying={isApplying && pendingAction === "apply"}
                  isKeeping={isApplying && pendingAction === "dismiss"} onApply={(text) => act("apply", text)}
                  onKeep={() => act("dismiss")} onDraftChange={(dirty) => {
                    if (dirty && !hasDraft) draftField.current = currentField;
                    if (!dirty) draftField.current = null;
                    setHasDraft(dirty);
                    onDraftChange?.(finding.id, dirty);
                  }} />
              ) : (
                <>
                  {finding.bullet_text && <blockquote className="break-words rounded-lg bg-paper-deep/60 p-3 text-sm text-ink">{finding.bullet_text}</blockquote>}
                  {finding.fix_text && <p className="text-sm text-ink-secondary">{finding.fix_text}</p>}
                  <p className="text-xs text-ink-muted">This suggestion needs a wider edit. Open the editor to update the relevant section.</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button href={'/resume/' + resumeId} variant="outline">Open editor</Button>
                    <Button variant="ghost" disabled={busy} isLoading={isApplying} onClick={() => act("dismiss")}>Keep mine</Button>
                  </div>
                </>
              )}
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-critical">{error}</p>}
        </div>
      )}
    </li>
  );
}

function FindingRewrite({ finding, original, replacement, busy, isApplying, isKeeping, onApply, onKeep, onDraftChange, evidence, outdated, dirty }: {
  dirty: boolean;
  outdated: boolean;
  evidence: string[];
  finding: ResumeReviewFinding;
  original: string;
  replacement: string | null;
  busy: boolean;
  isApplying: boolean;
  isKeeping: boolean;
  onApply: (text: string) => Promise<void>;
  onKeep: () => Promise<void>;
  onDraftChange: (dirty: boolean) => void;
}) {
  const initial = replacement ?? original;
  const blanks = useMemo(() => [...new Set(fillInPlaceholders(initial))], [initial]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<string | null>(null);
  let filled = initial;
  for (const blank of blanks) filled = filled.split(blank).join(answers[blank]?.trim() || blank);
  const text = edited ?? filled;
  const ready = !outdated && Boolean(text.trim()) && !hasFillInPlaceholder(text) && text.trim() !== original;
  const diff = useMemo(() => diffWords(original, text), [original, text]);
  const inputId = 'rewrite-' + finding.id;
  const hintId = inputId + '-hint';

  return (
    <>
      {outdated && <p role="alert" className="text-sm text-attention">This resume text changed elsewhere. Your draft is preserved below. Copy any wording you want to keep, then discard this draft and check again.</p>}
      {evidence.length > 0 && <details className="rounded-lg border border-border p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-ink focus-visible:outline-accent">Your confirmed evidence for this role</summary>
        <p className="mt-1 text-xs text-ink-secondary">From Skill Gap. Choose wording only if it fits this bullet, then review it before applying.</p>
        {evidence.map((text, index) => <div key={index} className="mt-3">
          <p className="whitespace-pre-wrap break-words text-sm text-ink-secondary">{text}</p>
          <Button variant="ghost" disabled={busy} onClick={() => { setEdited(text); onDraftChange(text !== initial); }}>Use this wording</Button>
        </div>)}
      </details>}
      {!replacement && finding.fix_text && <p className="text-sm text-ink-secondary">{finding.fix_text}</p>}
      {blanks.length > 0 && edited === null && (
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-ink">Add your real details</legend>
          <p className="text-xs text-ink-secondary">Use facts you know. If a detail does not apply, edit the rewrite below to remove it.</p>
          {blanks.map((blank, index) => (
            <div key={blank}>
              <label htmlFor={inputId + '-blank-' + index} className="mb-1 block text-sm text-ink">{blankQuestion(blank)}</label>
              <input id={inputId + '-blank-' + index} type="text" value={answers[blank] ?? ""} maxLength={1000}
                onChange={(event) => {
                  const next = { ...answers, [blank]: event.target.value };
                  setAnswers(next);
                  onDraftChange(Object.values(next).some((answer) => answer.length > 0));
                }}
                className="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent/40" />
            </div>
          ))}
        </fieldset>
      )}
      <div className="min-w-0 rounded-lg border border-border bg-paper-deep/40 p-3">
        <span className="text-xs font-medium text-ink-secondary">Current wording</span>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
          {original ? <WordDiff diff={diff} side="del" /> : "Nothing written here yet."}
        </p>
      </div>
      <div>
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-ink">
          {replacement ? "Suggested wording, yours to edit" : "Your improved wording"}
        </label>
        <textarea id={inputId} value={text} onChange={(event) => {
          setEdited(event.target.value);
          onDraftChange(event.target.value !== initial);
        }}
          disabled={busy} rows={4} maxLength={10000} aria-describedby={hintId}
          className="w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base leading-relaxed text-ink focus:outline-none focus:ring-2 focus:ring-accent/40" />
        <p id={hintId} className="mt-1 text-xs text-ink-secondary">Keep the meaning accurate. Only include numbers, tools and results you can support.</p>
      </div>
      {text.trim() !== original && (
        <div className="min-w-0 rounded-lg border border-border bg-paper-deep/40 p-3">
          <span className="text-xs font-medium text-ink-secondary">After your change</span>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink"><WordDiff diff={diff} side="add" /></p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={busy || !ready} isLoading={isApplying} onClick={() => onApply(text.trim())}>Apply change</Button>
        <Button variant="ghost" disabled={busy} isLoading={isKeeping} onClick={onKeep}>Keep mine</Button>
        {dirty && <Button variant="ghost" disabled={busy} onClick={() => { setEdited(null); setAnswers({}); onDraftChange(false); }}>Discard draft</Button>}
        {hasFillInPlaceholder(text) && <span className="text-xs text-ink-muted">Fill in or remove the [blanks] first.</span>}
      </div>
    </>
  );
}
