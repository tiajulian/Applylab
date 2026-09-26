/**
 * Every tunable number and option for the standalone cover letter feature lives here, so product
 * can change limits without touching logic. See COVER_LETTER.md.
 */

export const COVER_LETTER_LIMITS = {
  /** Non-deleted letters a free account can hold. Paid plans are unlimited. */
  freeLetters: 1,
  jobTitleMax: 100,
  companyMax: 100,
  jobDescriptionMax: 8000,
  hiringManagerMax: 80,
  titleMax: 160,
  bodyMax: 12000,
  /** Soft, non-blocking warning above this many words. */
  softWordWarning: 400,
  /** AI create requests per user per hour (the AI route's own stopgap, on top of the free-tier cap). */
  aiPerHour: 15,
  generationTimeoutMs: 45_000,
  /** How much of the job description the model sees. */
  jobDescriptionModelChars: 6000,
} as const;

/** A resume is "thin" when it has none of experience/education and fewer skills than this. */
export const THIN_RESUME = { minSkills: 3 } as const;

export const COVER_LETTER_TONES = ["professional", "friendly", "confident", "formal"] as const;
export type CoverLetterTone = (typeof COVER_LETTER_TONES)[number];

export const COVER_LETTER_LENGTHS = {
  short: { label: "Short", words: 150 },
  standard: { label: "Standard", words: 250 },
  detailed: { label: "Detailed", words: 350 },
} as const;
export type CoverLetterLength = keyof typeof COVER_LETTER_LENGTHS;

export const COVER_LETTER_FOCUS = ["Skills", "Achievements", "Career change", "Culture fit", "Relocation"] as const;
export type CoverLetterFocus = (typeof COVER_LETTER_FOCUS)[number];
export const MAX_FOCUS = 3;

export const COVER_LETTER_LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Italian"] as const;
export type CoverLetterLanguage = (typeof COVER_LETTER_LANGUAGES)[number];

export const DEFAULT_TONE: CoverLetterTone = "professional";
export const DEFAULT_LENGTH: CoverLetterLength = "standard";
export const DEFAULT_LANGUAGE: CoverLetterLanguage = "English";

/** Machine-readable codes on 402 responses. */
export const COVER_LETTER_ERROR_CODES = {
  limit: "COVER_LETTER_LIMIT",
  aiExhausted: "AI_CREDITS_EXHAUSTED",
  locked: "FEATURE_LOCKED",
} as const;

/** Feature keys mapped to who may use them; add a plan to a list to unlock it. Phase 1-4 uses create + aiGenerate. */
export const COVER_LETTER_FEATURES = {
  "coverLetter.create": ["free", "pro"],
  "coverLetter.aiGenerate": ["free", "pro"],
  "coverLetter.aiRewrite": ["pro"],
  "coverLetter.export": ["pro"],
  "coverLetter.multipleTemplates": ["pro"],
} as const;
export type CoverLetterFeature = keyof typeof COVER_LETTER_FEATURES;
