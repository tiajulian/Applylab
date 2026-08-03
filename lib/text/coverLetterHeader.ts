import type { ResumeContact } from "@/types";

/**
 * Australian long-form date (e.g. "2 August 2026") - the format the cover letter header uses.
 * The model never generates today's date; the template always renders it instead.
 *
 * timeZone is pinned to Australia/Sydney rather than left to the runtime's local time: the PDF/
 * DOCX exports render server-side (UTC on Vercel), so an unpinned `new Date()` formatted near
 * midnight AEST/AEDT could stamp the wrong calendar day. The preview renders client-side, but
 * pinning there too keeps it showing the same date the exports will produce.
 */
export function formatAustralianLongDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  }).format(date);
}

export interface CoverLetterHeader {
  name: string;
  /** Location, phone, email, and LinkedIn joined with " | ", blanks filtered out. */
  contactLine: string;
  date: string;
}

/**
 * Cover letter header content, rendered from the profile/resume contact - never from the model.
 * Shared by the preview, PDF, and DOCX renderers so the three stay in sync.
 */
export function buildCoverLetterHeader(contact: ResumeContact, date: Date = new Date()): CoverLetterHeader {
  const contactParts = [contact.location, contact.phone, contact.email, contact.linkedin].filter(Boolean);
  return {
    name: contact.name,
    contactLine: contactParts.join(" | "),
    date: formatAustralianLongDate(date),
  };
}
