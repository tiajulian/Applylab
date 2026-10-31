"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MetricPrompts, hasMetricBlank } from "@/components/profile/MetricPrompts";
import { WIN_OUTCOME_SHAPES } from "@/lib/wins/constants";

const control = "min-h-11 rounded-pill border border-border px-4 py-2 text-sm text-ink hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

/** The task is already known. Ask only for the missing outcome and optional evidence. */
export function ImpactGuide({ bulletText, assistsLeft, loading, options, error, onGenerate, onAccept, onClose, onEditAnswers }: {
  bulletText: string;
  assistsLeft: number | null;
  loading: boolean;
  options: string[] | null;
  error: string | null;
  onGenerate: (metric: string, outcome: string) => void;
  onAccept: (text: string) => void;
  onClose: () => void;
  onEditAnswers?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const title = useId();
  const field = useId();
  const [step, setStep] = useState(0);
  const [outcome, setOutcome] = useState("");
  const [metric, setMetric] = useState("");
  const [unsure, setUnsure] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => { if (options?.length) setDraft(options[0]); }, [options]);
  function requestClose() {
    if (outcome.trim() || metric.trim() || loading || draft.trim()) setConfirmClose(true);
    else closeGuide();
  }
  function closeGuide() {
    // Release the browser's modal focus containment before restoring focus to the toolbar.
    dialog.current?.close();
    onClose();
  }
  const preview = options !== null && options.length > 0;
  useEffect(() => { heading.current?.focus(); }, [step, preview]);
  return (
    <dialog ref={dialog} aria-labelledby={title} data-selection-keep
      onCancel={(event) => { event.preventDefault(); requestClose(); }}
      onMouseDown={(event) => event.stopPropagation()}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none flex-col overflow-hidden rounded-t-lg border border-border bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40 open:flex sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:w-[480px] sm:rounded-lg">
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border p-4 sm:p-6">
        <div><p className="text-xs text-ink-muted">{preview ? "Your improved bullet" : `Find your impact · ${step + 1} of 2`}</p>
          <h2 ref={heading} tabIndex={-1} id={title} className="mt-1 text-lg font-semibold outline-none">{preview ? "Does this sound like your work?" : step === 0 ? "What difference did your work make?" : "Can you put a number on it?"}</h2></div>
        <button type="button" className={control} aria-label="Close impact guide" onClick={requestClose}>Close</button>
      </header>
      <div className="space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-6">
        <div className="rounded border border-border bg-paper p-3"><p className="mb-1 text-xs font-medium text-ink-muted">Your original bullet</p><p className="text-sm leading-relaxed">{bulletText}</p></div>
        {confirmClose ? <div className="flex flex-col gap-3" role="alert"><p>Leave this guide? Your answers will be lost.</p><button className={control} onClick={() => setConfirmClose(false)}>Keep working</button><button className={control} onClick={closeGuide}>Leave guide</button></div> : preview ? <>
          {options.map((option, index) => <button key={index} type="button" className="min-h-11 w-full whitespace-normal break-words rounded border border-border p-3 text-left text-sm leading-relaxed hover:border-accent aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-pressed={draft === option} onClick={() => setDraft(option)}>{option}</button>)}
          <label htmlFor={field} className="text-sm font-medium">Make it your own</label><textarea id={field} rows={4} value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} className="w-full rounded border border-border-strong p-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
          <p className="text-xs text-ink-muted">Check every detail is true before using it.</p>
        </> : step === 0 ? <>
          <p className="text-sm text-ink-secondary">Small improvements count. Think about who used your work and what it helped them do. Pick a prompt only if it rings true.</p>
          <div className="flex flex-wrap gap-2">{WIN_OUTCOME_SHAPES.map((shape) => <button type="button" key={shape} className={control} onClick={() => { setUnsure(false); if (!outcome.trim() || WIN_OUTCOME_SHAPES.some((value) => value === outcome)) setOutcome(shape); }} aria-pressed={outcome === shape}>{shape}</button>)}<button type="button" className={control} aria-pressed={unsure} onClick={() => { setUnsure(true); if (WIN_OUTCOME_SHAPES.some((value) => value === outcome)) setOutcome(""); }}>I’m not sure</button></div>
          <label htmlFor={field} className="text-sm font-medium">{unsure ? "Who used your work, and what did they use it for?" : "What changed, or why did it matter?"}</label>
          <textarea autoFocus id={field} rows={3} maxLength={1000} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Tell us in your own words. Plain language is fine." className="w-full rounded border border-border-strong p-3 text-base focus:outline-none focus:ring-2 focus:ring-ring" />
        </> : <>
          <p className="text-sm text-ink-secondary">A rough, honest figure is fine. These questions can help you remember. No number? You can still improve the wording.</p>
          <MetricPrompts value={metric} onChange={setMetric} outcome={outcome} />
          {metric.length > 100 && <p role="alert" className="text-sm text-critical">Keep your number and what it measures to 100 characters or fewer.</p>}
        </>}
        {error && <p role="alert" className="text-sm text-critical">{error}</p>}
        {options?.length === 0 && <p role="status" className="text-sm text-ink-secondary">No safe suggestion found. You can adjust your answers and try again.</p>}
        {loading && <p role="status" className="text-sm text-ink-secondary">Writing your bullet using only the details you supplied…</p>}
      </div>
      {!confirmClose && <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
        {assistsLeft !== null && <p className="w-full text-xs text-ink-muted">{assistsLeft} free AI edits left on this resume. Questions use no edits.</p>}
        {preview ? <><button type="button" className={`${control} bg-accent text-white`} disabled={!draft.trim() || loading} onClick={() => { dialog.current?.close(); onAccept(draft.trim()); }}>Use this version</button><button type="button" className={control} onClick={() => { setStep(0); onEditAnswers?.(); }}>Edit answers</button></> : step === 0 ? <>
          <button type="button" className={`${control} bg-accent text-white`} onClick={() => setStep(1)}>Continue</button>
          <button type="button" className={control} onClick={() => setStep(1)}>Skip for now</button>
        </> : <>
          <button type="button" className={control} disabled={loading} onClick={() => setStep(0)}>Back</button>
          <button type="button" className={`${control} bg-accent text-white`} disabled={loading || hasMetricBlank(metric) || metric.length > 100} onClick={() => onGenerate(metric.trim(), outcome.trim())}>{loading ? "Writing…" : "Preview improved bullet"}</button>
          <button type="button" className={control} disabled={loading} onClick={() => { setMetric(""); onGenerate("", outcome.trim()); }}>Continue without a number</button>
        </>}
      </footer>}
    </dialog>
  );
}
