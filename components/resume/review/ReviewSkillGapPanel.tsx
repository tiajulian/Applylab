"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { confirmedSkillEvidence, skillGapRole, type ReviewSkillGap } from "@/lib/resume/reviewSkillGap";
import type { ResumeContent, SkillsBridgeItem } from "@/types";

export function ReviewSkillGapPanel({ context, content, onDraftChange, onChange, disabled = false }: {
  disabled?: boolean;
  context: ReviewSkillGap;
  content: ResumeContent;
  onDraftChange: (id: string, dirty: boolean) => void;
  onChange: (item: SkillsBridgeItem) => void;
}) {
  const items = context.items;
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(() => new Set());
  function trackDraft(id: string, dirty: boolean) {
    setDirtyIds((previous) => { const next = new Set(previous); if (dirty) next.add(id); else next.delete(id); return next; });
    onDraftChange(id, dirty);
  }
  const [openId, setOpenId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [notice, setNotice] = useState("");
  const confirmed = items.filter((item) => confirmedSkillEvidence(item) && skillGapRole(content, item) !== null);
  const questions = items.filter((item) => item.state === "to_confirm" && item.user_state === "pending" && skillGapRole(content, item) !== null);
  const preparation = items.filter((item) => item.state === "gap" || item.user_state === "rejected");

  if (!confirmed.length && !questions.length && !preparation.length) return null;
  return (
    <fieldset disabled={disabled} aria-label="Your Skill Gap answers" className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <h2 ref={heading} tabIndex={-1} className="text-h3 font-semibold text-ink focus:outline-none">Your Skill Gap answers</h2>
      <p className="mt-1 text-sm text-ink-secondary">From the check linked to this job. Review these alongside your resume; they do not change it automatically.</p>
      {confirmed.length > 0 && <details className="mt-3">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink focus-visible:outline-accent">Evidence already confirmed ({confirmed.length})</summary>
        <ul className="space-y-3">{confirmed.map((item) => <li key={item.id} className="rounded-lg bg-paper-deep/50 p-3">
          <p className="text-sm font-medium text-ink">{item.target_requirement}</p>
          <p className="mt-1 text-xs text-ink-muted">{item.source_job_title} · {item.source_company}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-secondary">{confirmedSkillEvidence(item)}</p>
          <p className="mt-2 text-xs text-ink-muted">Use this only where it accurately describes your work. It may already be included in your resume.</p>
          <Button variant="ghost" onClick={() => setOpenId(openId === item.id ? null : item.id)}>Edit answer</Button>
        </li>)}</ul>
      </details>}
      {questions.length > 0 && <p className="mt-3 text-sm text-ink-secondary">A few details are still unconfirmed. Answer only if you want to add evidence.</p>}
      {items.filter((item) => item.state !== "gap" && skillGapRole(content, item) !== null).map((item) => (
        <div key={item.id} hidden={!questions.some((question) => question.id === item.id) && openId !== item.id && !dirtyIds.has(`skill-gap-${item.id}`)}>
        <SkillQuestion item={item} bridgeId={context.bridgeId} editing={openId === item.id}
          onDraftChange={trackDraft} onSaved={(updated) => {
            onChange(updated);
            setOpenId(null);
            setNotice(updated.user_state === "confirmed" ? "Answer saved. Your confirmed evidence is available below. Your resume is unchanged." : "Answer saved. You can revisit it under Prepare for this role. Your resume is unchanged.");
            heading.current?.focus({ preventScroll: true });
          }} /></div>
      ))}
      {preparation.length > 0 && <details className="mt-3 border-t border-border pt-2">
        <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium text-ink focus-visible:outline-accent">Prepare for this role ({preparation.length})</summary>
        <p className="text-sm text-ink-secondary">These requirements were not evidenced in the earlier check, or you answered No. That does not prove you lack the skill. If needed, build a real example through learning or practice; do not claim experience you do not have.</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink">{preparation.map((item) => <li key={item.id}>
          {item.target_requirement}
          {item.state !== "gap" && skillGapRole(content, item) !== null && <Button variant="ghost" onClick={() => setOpenId(item.id)}>Revisit answer</Button>}
        </li>)}</ul>
      </details>}
      <p className="mt-3 text-xs text-ink-muted">Answers are saved to Skill Gap only. Your resume and profile stay unchanged.</p>
      <p role="status" className="mt-2 text-sm text-ink-secondary">{notice}</p>
    </fieldset>
  );
}

function SkillQuestion({ item, bridgeId, editing, onDraftChange, onSaved }: {
  item: SkillsBridgeItem;
  bridgeId: string;
  editing: boolean;
  onDraftChange: (id: string, dirty: boolean) => void;
  onSaved: (item: SkillsBridgeItem) => void;
}) {
  const [answering, setAnswering] = useState(editing);
  const [skipped, setSkipped] = useState(false);
  const [note, setNote] = useState(item.user_note ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const draftId = `skill-gap-${item.id}`;
  useEffect(() => { if (editing) setAnswering(true); }, [editing]);

  async function save(userState: "confirmed" | "rejected") {
    if (pending.current) return;
    if (userState === "confirmed" && !note.trim()) { setError("Add a short example of what you actually did first."); return; }
    pending.current = true;
    onDraftChange(draftId, true);
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/skills-bridge/${bridgeId}/items/${item.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_state: userState, ...(userState === "confirmed" ? { user_note: note.trim() } : {}),
          expected_user_state: item.user_state, expected_user_note: item.user_note,
          expected_source: { state: item.state, company: item.source_company, job_title: item.source_job_title } }),
      });
      const data = await response.json().catch(() => ({}));
      const saved = data?.item;
      if (!response.ok || !saved || saved.id !== item.id || saved.bridge_id !== bridgeId || saved.user_state !== userState
        || saved.state !== item.state || saved.source_company !== item.source_company || saved.source_job_title !== item.source_job_title
        || typeof saved.competency !== "string" || typeof saved.target_requirement !== "string"
        || (saved.user_note !== null && typeof saved.user_note !== "string")
        || (userState === "confirmed" && saved.user_note !== note.trim())) {
        throw new Error(data?.error ?? "We couldn't confirm the save. Your answer is still here; try again.");
      }
      onDraftChange(draftId, false);
      setAnswering(false);
      onSaved(saved);
    } catch (cause) {
      onDraftChange(draftId, note !== (item.user_note ?? ""));
      setError(cause instanceof Error ? cause.message : "Couldn't save your answer. Please try again.");
    } finally { pending.current = false; setSaving(false); }
  }

  return (
    <div className="mt-3 rounded-lg border border-border p-3">
      <h3 className="break-words text-sm font-medium text-ink">{item.competency}</h3>
      <p className="mt-1 text-xs text-ink-secondary">For: {item.target_requirement}</p>
      <p className="mt-1 text-xs text-ink-muted">{item.source_job_title} · {item.source_company}</p>
      {skipped ? <div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-sm text-ink-secondary">Skipped for now.</span><Button variant="ghost" onClick={() => setSkipped(false)}>Answer later</Button></div>
        : answering ? <>
          <label htmlFor={draftId} className="mt-3 block text-sm text-ink">What did you actually do?</label>
          <textarea id={draftId} autoFocus value={note} maxLength={2000} rows={3} disabled={saving}
            onChange={(event) => { setNote(event.target.value); onDraftChange(draftId, event.target.value !== (item.user_note ?? "")); }}
            className="mt-1 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-base text-ink focus:outline-accent" />
          <p className="mt-1 text-xs text-ink-secondary">Use your own words. Numbers are optional. Nothing is added to your resume yet.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button disabled={!note.trim()} isLoading={saving} onClick={() => save("confirmed")}>Save answer</Button>
            <Button variant="ghost" disabled={saving} onClick={() => { setAnswering(false); setNote(item.user_note ?? ""); onDraftChange(draftId, false); }}>Cancel</Button>
          </div>
        </> : <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" disabled={saving} onClick={() => setAnswering(true)}>Yes</Button>
          <Button variant="outline" isLoading={saving} onClick={() => save("rejected")}>No</Button>
          <Button variant="ghost" disabled={saving} onClick={() => setSkipped(true)}>Skip</Button>
        </div>}
      {error && <p role="alert" className="mt-2 text-sm text-critical">{error}</p>}
    </div>
  );
}
