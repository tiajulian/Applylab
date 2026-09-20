import { NextResponse } from "next/server";
import { COVER_LETTER_ERROR_CODES, COVER_LETTER_V1_ENABLED } from "@/lib/coverLetter/config";
import type { ResumeContent } from "@/types";

/** Route guard for the feature flag: with the flag off every cover letter route behaves as if it does not exist. */
export function featureDisabledResponse(): NextResponse | null {
  return COVER_LETTER_V1_ENABLED ? null : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function letterLimitResponse(limit: number): NextResponse {
  return NextResponse.json(
    { error: "Cover letter limit reached", code: COVER_LETTER_ERROR_CODES.limit, limit },
    { status: 402 }
  );
}

/** The public shape of a row: `idempotency_key` and the model-only job description stay server-side. */
export const LETTER_COLUMNS =
  "id, resume_id, title, job_title, company, hiring_manager, content, language, tone, length, created_via, status, word_count, created_at, updated_at";

/** "Thin" resume: nothing to write a specific letter from (no experience, no education, few skills). */
export function isThinResume(content: ResumeContent | null, minSkills: number): boolean {
  if (!content) return true;
  return content.experience.length === 0 && content.education.length === 0 && content.skills.length < minSkills;
}
