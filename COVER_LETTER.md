# Cover letters

Standalone cover letters: their own table, editor (`/cover-letter/:id`), hub (`/cover-letter`) and a two-step
setup modal. Separate from the older per-resume letter in `resumes.cover_letter_content`, which the resume
workspace still uses.

## Setup

Apply `supabase/migrations/20260921000000_cover_letters.sql`. There is no feature flag: the feature is always on.

## Config: `lib/coverLetter/config.ts`

| Key | Meaning |
|---|---|
| `COVER_LETTER_LIMITS.freeLetters` | Non-deleted letters a free account can hold (default 1) |
| `COVER_LETTER_LIMITS.*Max` | Field length limits (title, company, job description, hiring manager, body) |
| `COVER_LETTER_LIMITS.softWordWarning` | Amber word-count hint (400) |
| `COVER_LETTER_LIMITS.aiPerHour` | Per-user hourly cap on AI creates |
| `COVER_LETTER_LIMITS.generationTimeoutMs` | Generation timeout (45s), one silent retry |
| `THIN_RESUME.minSkills` | A resume with no experience, no education and fewer skills than this is "thin" |
| `COVER_LETTER_FEATURES` | Feature key -> plans that may use it |
| `COVER_LETTER_TONES/LENGTHS/FOCUS/LANGUAGES` | Options offered in the modal |

The free-tier **AI generation** cap is the existing `FREE_TIER_FEATURE_LIMITS["cover-letter"]` in
`lib/requireUser.ts` (shared with the resume workspace's generator, so a generation in either place counts).

## Endpoints

- `GET /api/cover-letters` list (`?resumeId=`), `POST` create (`mode: "ai" | "blank"`, needs `idempotencyKey`)
- `GET|PATCH|DELETE /api/cover-letters/:id`. PATCH takes `title`, `body`, `expectedUpdatedAt` and returns `409 CONFLICT` if the
  row moved on; DELETE is a soft delete.
- `GET /api/cover-letters/entitlements` gating info plus the resume list for the modal

Letter cap: `402 { code: "COVER_LETTER_LIMIT" }`. AI allowance: the existing `403 { code: "FREE_LIMIT_REACHED" }`.
Inserts only happen server-side (the `authenticated` role has no INSERT grant), so the caps cannot be bypassed from the browser.
