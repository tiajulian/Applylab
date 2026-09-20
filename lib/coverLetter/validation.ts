import {
  COVER_LETTER_FOCUS,
  COVER_LETTER_LANGUAGES,
  COVER_LETTER_LENGTHS,
  COVER_LETTER_LIMITS,
  COVER_LETTER_TONES,
  DEFAULT_LANGUAGE,
  DEFAULT_LENGTH,
  DEFAULT_TONE,
  MAX_FOCUS,
  type CoverLetterFocus,
  type CoverLetterLanguage,
  type CoverLetterLength,
  type CoverLetterTone,
} from "@/lib/coverLetter/config";

/** `[Job Title]`, `[Company]`: a bracketed template placeholder that must never reach a letter. */
const PLACEHOLDER = /\[[^\]]*\]/;

export function hasPlaceholder(value: string): boolean {
  return PLACEHOLDER.test(value);
}

/**
 * A prefill value for job title/company: a bracket placeholder or whitespace becomes empty so the
 * field starts blank rather than carrying "[Job Title]" into the letter.
 */
export function cleanPrefill(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  return hasPlaceholder(trimmed) ? "" : trimmed;
}

export interface CreateInput {
  mode: "ai" | "blank";
  resumeId: string | null;
  jobTitle: string;
  company: string;
  hiringManager: string;
  jobDescription: string;
  tone: CoverLetterTone;
  length: CoverLetterLength;
  language: CoverLetterLanguage;
  focus: CoverLetterFocus[];
  idempotencyKey: string;
}

export type CreateInputErrors = Partial<
  Record<"jobTitle" | "company" | "jobDescription" | "hiringManager" | "resumeId", string>
>;

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Shared by the setup modal (inline errors) and the create route (the real enforcement). */
export function validateCreateInput(raw: unknown): { input: CreateInput; errors: CreateInputErrors } {
  const body = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const mode = body.mode === "blank" ? "blank" : "ai";
  const focus = Array.isArray(body.focus)
    ? Array.from(
        new Set(body.focus.filter((f): f is CoverLetterFocus => (COVER_LETTER_FOCUS as readonly unknown[]).includes(f)))
      ).slice(0, MAX_FOCUS)
    : [];

  const input: CreateInput = {
    mode,
    resumeId: typeof body.resumeId === "string" && body.resumeId ? body.resumeId : null,
    jobTitle: text(body.jobTitle),
    company: text(body.company),
    hiringManager: text(body.hiringManager),
    jobDescription: text(body.jobDescription),
    tone: pick(body.tone, COVER_LETTER_TONES, DEFAULT_TONE),
    length: pick(body.length, Object.keys(COVER_LETTER_LENGTHS) as CoverLetterLength[], DEFAULT_LENGTH),
    language: pick(body.language, COVER_LETTER_LANGUAGES, DEFAULT_LANGUAGE),
    focus,
    idempotencyKey: text(body.idempotencyKey),
  };

  const errors: CreateInputErrors = {};
  const { jobTitleMax, companyMax, jobDescriptionMax, hiringManagerMax } = COVER_LETTER_LIMITS;

  if (input.jobTitle.length > jobTitleMax) errors.jobTitle = `Job title is too long (max ${jobTitleMax} characters).`;
  else if (hasPlaceholder(input.jobTitle)) errors.jobTitle = "Replace the placeholder with the real job title.";
  else if (mode === "ai" && !input.jobTitle) errors.jobTitle = "Please enter a job title.";

  if (input.company.length > companyMax) errors.company = `Company name is too long (max ${companyMax} characters).`;
  else if (hasPlaceholder(input.company)) errors.company = "Replace the placeholder with the real company name.";
  else if (mode === "ai" && !input.company) errors.company = "Please enter the company name.";

  if (input.jobDescription.length > jobDescriptionMax) {
    errors.jobDescription = `Job description is too long (max ${jobDescriptionMax.toLocaleString("en-US")} characters).`;
  }
  if (input.hiringManager.length > hiringManagerMax) {
    errors.hiringManager = `Name is too long (max ${hiringManagerMax} characters).`;
  }
  if (mode === "ai" && !input.resumeId) errors.resumeId = "Choose a resume so we can personalise your letter.";

  return { input, errors };
}
