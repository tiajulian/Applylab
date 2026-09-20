import type { ResumeContact } from "@/types";

/**
 * What a cover letter stores in `cover_letters.content`. `contact` is a one-way copy of the resume's
 * contact details taken at creation (editing the letter never touches the resume). `body` is the whole
 * letter from the greeting to the sign-off, edited as plain text on the paper.
 */
export interface CoverLetterContent {
  contact: ResumeContact;
  body: string;
}

export const EMPTY_CONTACT: ResumeContact = { name: "", phone: "", email: "", location: "", linkedin: "", work_rights: "" };

export function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Default title: "{Job Title} - {Company} | Cover Letter", degrading gracefully when either is missing. */
export function defaultTitle(jobTitle: string, company: string): string {
  const role = [jobTitle, company].filter(Boolean).join(" - ");
  return role ? `${role} | Cover Letter` : "Cover Letter";
}

/** A blank letter starts with the salutation and sign-off so the paper is not an empty page. */
export function blankBody(hiringManager: string, name: string): string {
  return `Dear ${hiringManager || "Hiring Manager"},\n\n\n\nKind regards,\n${name}`.trimEnd();
}

/** Stored JSON is parsed defensively: anything malformed falls back to an empty letter. */
export function parseContent(raw: unknown): CoverLetterContent {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<CoverLetterContent>;
  return {
    contact: { ...EMPTY_CONTACT, ...(value.contact ?? {}) },
    body: typeof value.body === "string" ? value.body : "",
  };
}
