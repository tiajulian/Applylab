"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { DownloadMenu } from "@/components/resume/DownloadMenu";
import { Reveal } from "@/components/ui/Reveal";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { buildCoverLetterHeader, buildCoverLetterRecipient } from "@/lib/text/coverLetterHeader";
import type { ResumeContact } from "@/types";

/** The exported PDF/DOCX use Arial at these sizes, so the paper matches what people download. */
const PAPER_FONT = "Arial, Helvetica, sans-serif";

/**
 * The cover letter as a sheet of A4 paper: the header (name, contact line, date) is rendered from the
 * profile exactly as the exports do, and the letter body is edited right on the paper. It autosaves,
 * and Download saves first, so the file always carries the latest text.
 */
export function CoverLetterPreview({
  resumeId,
  initialCoverLetter,
  contact,
  companyName,
  isPaidPlan,
  isUnlocked,
  downloadingFormat,
  onDownload,
  onDownloadLocked,
}: {
  resumeId: string;
  initialCoverLetter: string;
  contact: ResumeContact;
  /** The employer, for the address block above the greeting. */
  companyName: string | null;
  isPaidPlan: boolean;
  isUnlocked: boolean;
  downloadingFormat: "pdf" | "docx" | null;
  onDownload: (format: "pdf" | "docx") => void;
  onDownloadLocked: () => void;
}) {
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter);
  // Computed once per mount rather than re-run on every render - the letter's date shouldn't
  // silently roll over to tomorrow under the user's cursor while they're mid-edit.
  const [header] = useState(() => buildCoverLetterHeader(contact));
  const recipient = buildCoverLetterRecipient(coverLetter, companyName);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const savedText = useRef(initialCoverLetter);

  const { status, error, saveNow } = useAutosave(coverLetter, async (value) => {
    const response = await fetch(`/api/resume/${resumeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cover_letter_content: value }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error ?? "Failed to save cover letter");
    }
    savedText.current = value;
  });

  // The textarea has no scrollbar of its own: it grows with the letter and the paper grows with it.
  const fit = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  useLayoutEffect(fit, [coverLetter, fit]);

  // Narrowing the window re-wraps the text without changing it, so re-measure when the width changes
  // (only the width: setting the height must not retrigger this).
  useEffect(() => {
    const el = textRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  /** The download reads the saved letter on the server, so save any pending edit first; never export stale text. */
  async function saveBeforeDownload(): Promise<boolean> {
    if (coverLetter === savedText.current) return true;
    await saveNow();
    // Saved means the server now holds what is on the page; an older save failing late cannot fake that.
    return savedText.current === coverLetter;
  }

  return (
    <Reveal>
      <div className="flex w-full flex-col items-center gap-3 rounded-xl border border-border/80 bg-paper-deep/30 p-3 sm:p-4">
        <div className="flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-secondary">
            Click the letter to edit it; changes save automatically. Your name and contact details come from your{" "}
            <Link href="/profile" className="underline underline-offset-2 hover:text-ink">
              profile
            </Link>
            .
          </p>
          <div className="ml-auto flex items-center gap-3">
            <span role="status" aria-live="polite" className="min-w-[4.5rem] text-right text-xs text-ink-secondary">
              {status === "saving" && "Saving…"}
              {status === "saved" && "Saved"}
              {status === "error" && <span className="text-critical">{error ?? "Failed to save"}</span>}
            </span>
            <DownloadMenu
              noun="cover letter"
              variant="bar"
              isPaidPlan={isPaidPlan}
              isUnlocked={isUnlocked}
              downloadingFormat={downloadingFormat}
              onDownload={onDownload}
              onDownloadLocked={onDownloadLocked}
              beforeDownload={saveBeforeDownload}
            />
          </div>
        </div>

        {/* The sheet. A4 proportions from tablet width up; on a phone it is simply full width. */}
        <div
          onClick={(e) => {
            // A click on the paper's margins or header goes to the letter, like clicking a real page.
            if ((e.target as HTMLElement).closest("textarea") || window.getSelection()?.toString()) return;
            textRef.current?.focus();
          }}
          className="w-full max-w-[210mm] cursor-text bg-white px-6 py-8 shadow-md ring-1 ring-black/5 transition-shadow focus-within:shadow-lg focus-within:ring-2 focus-within:ring-accent/30 sm:min-h-[297mm] sm:px-[22mm] sm:py-[20mm]"
          style={{ fontFamily: PAPER_FONT, color: "#1a1a1a" }}
        >
          {/* From the profile and today's date - never from the model, and not edited here. */}
          <div className="mb-[8mm]">
            <p className="mb-[2mm] text-[15pt] font-bold leading-tight">{header.name}</p>
            {header.contactLine && <p className="mb-[2mm] text-[9.5pt] text-[#444444]">{header.contactLine}</p>}
            <p className="text-[9.5pt] text-[#444444]">{header.date}</p>
          </div>

          {/* Addressed to: follows the greeting in the letter below, and appears in the exports too. */}
          {recipient.length > 0 && (
            <div className="mb-[6mm] text-[11pt] leading-[1.5]" data-recipient>
              {recipient.map((line, i) => (
                <p key={`${i}-${line}`}>{line}</p>
              ))}
            </div>
          )}

          <textarea
            ref={textRef}
            value={coverLetter}
            onChange={(e) => setCoverLetter(e.target.value)}
            aria-label="Cover letter text"
            lang="en-AU"
            spellCheck
            rows={1}
            className="block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[11pt] leading-[1.6] text-[#1a1a1a] outline-none focus-visible:outline-none"
            style={{ fontFamily: PAPER_FONT }}
          />
        </div>
      </div>
    </Reveal>
  );
}
