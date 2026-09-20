"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ArrowLeftIcon } from "@/components/ui/icons/LucideIcons";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { COVER_LETTER_LIMITS } from "@/lib/coverLetter/config";
import { countWords } from "@/lib/coverLetter/content";
import { buildCoverLetterHeader, buildCoverLetterRecipient } from "@/lib/text/coverLetterHeader";
import type { ResumeContact } from "@/types";

/** The exports use Arial, so the paper matches what people will download. */
const PAPER_FONT = "Arial, Helvetica, sans-serif";

/**
 * The standalone cover letter editor: an A4 sheet edited in place, autosaved with a version check so a
 * second tab can never be silently overwritten.
 */
export function CoverLetterEditor({
  id,
  initialTitle,
  initialBody,
  initialUpdatedAt,
  contact,
  company,
}: {
  id: string;
  initialTitle: string;
  initialBody: string;
  initialUpdatedAt: string;
  contact: ResumeContact;
  company: string;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [conflict, setConflict] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [header] = useState(() => buildCoverLetterHeader(contact));
  const recipient = buildCoverLetterRecipient(body, company);
  const textRef = useRef<HTMLTextAreaElement>(null);
  // The row version the server last accepted; sent back so a save from a stale tab is refused.
  const updatedAt = useRef(initialUpdatedAt);
  const words = countWords(body);

  // Saves run one at a time: a second save started while the first is in flight would send the old
  // version stamp and be refused as a conflict with the user's own earlier edit.
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());

  async function save(serialized: string) {
    const response = await fetch(`/api/cover-letters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...JSON.parse(serialized), expectedUpdatedAt: updatedAt.current }),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409) setConflict(true);
    if (!response.ok) throw new Error(data.error ?? "Failed to save");
    updatedAt.current = data.updatedAt;
  }

  const { status, error } = useAutosave(JSON.stringify({ title, body }), (serialized) => {
    const run = saveQueue.current.then(() => save(serialized));
    saveQueue.current = run.catch(() => undefined);
    return run;
  });

  // Warn before closing the tab while a save is in flight or has failed.
  useEffect(() => {
    if (status !== "saving" && status !== "error") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [status]);

  // The textarea grows with the letter; the paper grows with it.
  const fit = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(fit, [body, fit]);

  async function handleDelete() {
    setIsDeleting(true);
    const response = await fetch(`/api/cover-letters/${id}`, { method: "DELETE" }).catch(() => null);
    if (!response?.ok) {
      setIsDeleting(false);
      setIsConfirmingDelete(false);
      return showToast("We couldn't delete this cover letter. Try again.", "critical");
    }
    showToast("Cover letter deleted");
    router.push("/cover-letter");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/cover-letter"
          aria-label="Back to cover letters"
          className="rounded-full p-1.5 text-ink-secondary hover:bg-paper-deep hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={COVER_LETTER_LIMITS.titleMax}
          aria-label="Cover letter title"
          className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 font-display text-h3 text-ink hover:border-border focus:border-accent focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <span role="status" aria-live="polite" className="min-w-[4.5rem] text-right text-xs text-ink-secondary">
          {status === "saving" && "Saving…"}
          {status === "saved" && "Saved"}
          {status === "error" && !conflict && <span className="text-critical">{error ?? "Failed to save"}</span>}
        </span>
        <Button type="button" variant="ghost" size="sm" className="text-critical" onClick={() => setIsConfirmingDelete(true)}>
          Delete
        </Button>
      </div>

      {conflict && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded border border-attention/40 bg-attention-soft px-4 py-2 text-sm text-attention">
          This letter was updated in another tab. Reload?
          <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      )}

      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-border/80 bg-paper-deep/30 p-3 sm:p-4">
        <div className="flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-2 text-xs text-ink-secondary">
          <p>Click the letter to edit it; changes save automatically.</p>
          <p className={words > COVER_LETTER_LIMITS.softWordWarning ? "font-medium text-attention" : undefined}>
            {words} {words === 1 ? "word" : "words"}
            {words > COVER_LETTER_LIMITS.softWordWarning && " · Most recruiters prefer cover letters under one page."}
          </p>
        </div>

        <div
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("textarea") || window.getSelection()?.toString()) return;
            textRef.current?.focus();
          }}
          className="w-full max-w-[210mm] cursor-text bg-white px-6 py-8 shadow-md ring-1 ring-black/5 transition-shadow focus-within:shadow-lg focus-within:ring-2 focus-within:ring-accent/30 sm:min-h-[297mm] sm:px-[22mm] sm:py-[20mm]"
          style={{ fontFamily: PAPER_FONT, color: "#1a1a1a" }}
        >
          <div className="mb-[8mm]">
            <p className="mb-[2mm] text-[15pt] font-bold leading-tight">{header.name}</p>
            {header.contactLine && <p className="mb-[2mm] text-[9.5pt] text-[#444444]">{header.contactLine}</p>}
            <p className="text-[9.5pt] text-[#444444]">{header.date}</p>
          </div>

          {recipient.length > 0 && (
            <div className="mb-[6mm] text-[11pt] leading-[1.5]">
              {recipient.map((line, i) => (
                <p key={`${i}-${line}`}>{line}</p>
              ))}
            </div>
          )}

          <textarea
            ref={textRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={COVER_LETTER_LIMITS.bodyMax}
            aria-label="Cover letter text"
            spellCheck
            rows={1}
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[11pt] leading-[1.6] text-[#1a1a1a] outline-none focus-visible:outline-none"
            style={{ fontFamily: PAPER_FONT }}
          />
        </div>
      </div>

      {isConfirmingDelete && (
        <ConfirmDialog
          title="Delete this cover letter?"
          description="This can't be undone."
          confirmLabel="Delete"
          isDestructive
          isConfirming={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
