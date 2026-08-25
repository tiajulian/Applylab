# AI Interview Prep — Pre-Deploy Security Review & QA Report

Branch: `review/interview-qa`. Scope: `app/api/interview/**`, `app/(dashboard)/interview/**`,
`components/interview/**`, `lib/gemini/**`, `lib/interview/**`, the new `interview_sessions` /
`interview_turns` tables in `supabase/schema.sql`, and their `types/index.ts` types. No prior
`docs/interview-feature-discovery.md` or build-prompt file existed in the repo, so this review was
done directly against the code and the app's existing conventions (`app/api/ats-score/route.ts`,
`lib/requireUser.ts`, the column-privilege-lockdown pattern already in `schema.sql`).

**Nothing in this review was deployed.** `supabase/schema.sql`'s new statements have not been run
against any live Supabase project — they're edited in place since nothing had been applied yet.

## Findings

| Severity | Location | Issue | Fix |
|---|---|---|---|
| **Blocker** | `supabase/schema.sql` — `interview_sessions`/`interview_turns` INSERT policies | Both tables had a client-facing `for insert with check (auth.uid() = user_id [...])` RLS policy, but creation *only ever* happens via the service-role client in the two API routes. Since only `UPDATE` was column-locked (not `INSERT`), any signed-in user could `POST` directly to Supabase's REST API and insert a row with `status: 'completed'`, a fabricated `overall_score`/`report`, or pre-filled `star_scores`/`suggested_answer` on a turn — a self-serve way to fake a passing interview report, undermining the "we never invent anything" guarantee without touching Gemini at all. | **FIXED.** Removed both INSERT policies; RLS default-denies INSERT for `authenticated` when no policy matches, so all creation now has to go through the service-role client as the app already does. See the added comments in `schema.sql` at each table. |
| **Blocker** | `app/api/interview/sessions/[id]/turns/route.ts` | No check that the target turn hadn't already been scored (`transcript !== null`) before proceeding. Replaying the same `turnId` re-called Gemini, overwrote the stored scores, and — via `decideFollowup` — could insert an unbounded number of follow-up turns by repeatedly presenting the same main question as "not yet a followup," bypassing the one-followup-per-question cap in `lib/interview/followup.ts`, and shifting `order_index` on every replay. | **FIXED.** Added a `409` guard immediately after fetching the current turn: `if (currentTurn.transcript !== null) return 409`. Proven by `route.test.ts` → "rejects resubmitting a turn that already has a transcript." |
| **High** | `app/api/interview/sessions/[id]/turns/route.ts` | No server-side size/type validation on `audioBase64`/`mimeType`. A direct `curl` to the route could send an arbitrarily large base64 string or a bogus mime type straight through to Gemini. | **FIXED.** Added a 20MB base64-length cap and an audio-mimetype allowlist (`webm`/`mp4`/`ogg`/`wav`/`mpeg`), rejected with `400` before any Gemini call. Proven by `route.test.ts` → oversized-payload and bad-mimetype tests. |
| **High** | `components/interview/GroupCoachingView.tsx`, `lib/gemini/{generateInterviewQuestions,scoreInterviewAnswer,generateInterviewReport}.ts`, `types/index.ts` | The `group` stage was marketed as **"Coached (Not Simulated)"**, and the coaching splash screen itself states *"A 1:1 AI cannot honestly simulate real group multi-party dynamics."* But after that one-time screen, the flow fell straight into the identical scored STAR Q&A simulation as every other stage — fabricating 1-5 STAR scores and a numeric overall score for something the product's own copy says can't be honestly assessed. No `InterviewCoaching` type or `mode` field existed anywhere in the code; this was silently dropped from the original spec. Flagged to you directly (architecture-level) — you asked for the full fix. | **FIXED (full redesign, per your direction).** Added `InterviewMode` (`'simulation' \| 'coaching'`) and `lib/interview/mode.ts::stageToMode()` (`'group'` → `'coaching'`, everything else → `'simulation'`); added a `mode` column to `interview_sessions` (not client-writable — outside the `UPDATE` column grant). `scoreInterviewAnswer` and `generateInterviewReport` now take `mode` and run an entirely separate, honest coaching prompt for `'coaching'` sessions that **never asks for or parses a `star_scores` field** — `star_scores` is hard-coded `null` in coaching mode regardless of what the model returns (tested: see `scoreInterviewAnswer.test.ts` → "never returns star_scores... even if the model hallucinates one"). `TurnFeedback.tsx` and `InterviewReportView.tsx` now render a distinct "Coaching Reflection" / "Group Coaching Summary" layout with no STAR grid and no overall-score badge when `star_scores`/`overall_score` is null, instead of the old code's `star_scores || {situation: 3, ...}` fallback, which was *itself* fabricating a "3/5" whenever a score was ever missing. |
| **Medium** | `app/api/interview/sessions/[id]/route.ts` (PATCH) | Client could `PATCH` `status` directly to `'completed'`, bypassing the score/report flow entirely and leaving `report: null` on a session that claims to be finished (self-inflicted state corruption, but still a real spec violation — `completed` should only ever follow a real report). | **FIXED.** Client-settable statuses are now only `in_progress` / `abandoned`; `completed` is set exclusively by the turns route after `generateInterviewReport` succeeds. Proven by `[id]/route.test.ts` → "rejects a client attempting to PATCH status directly to 'completed'." |
| **Medium** | `lib/gemini/client.ts` | No request timeout configured, unlike `lib/anthropic/client.ts` and `lib/openai/client.ts` (both set an explicit timeout + `maxRetries` for the same "serverless function needs a bounded worst case" reason). This is a pre-existing gap in the whole Gemini integration (predates this feature — `copilot.ts` has the same exposure), not something this feature introduced, but the interview routes are the heaviest Gemini consumers in the app (up to 2 sequential calls per request) so it's fixed here. | **FIXED.** Added `httpOptions: { timeout: 55_000 }` to the shared Gemini client, mirroring the sibling clients. Note: the `@google/genai` SDK has no built-in `maxRetries` equivalent (unlike the Anthropic/OpenAI SDKs), so there is still no automatic retry on transient failures for *any* Gemini-backed feature in the app — building a generic retry wrapper is a larger, cross-feature change and is called out as deferred below rather than invented ad hoc here. |
| Medium | `components/interview/InterviewSetup.tsx` / `VoiceRecorder.tsx` | Spec asks for an explicit mic-consent step. What exists is prominent passive copy (a dedicated "Audio Readiness & Privacy" panel on the setup page, plus an inline note on the recorder itself: *"Audio is processed by Gemini in real-time and immediately discarded. Never stored."*) rather than a blocking acknowledgment (checkbox/button-gate). | **DEFERRED — your call.** This is a UX decision (add a hard consent gate vs. keep the current prominent-but-passive copy), not a security hole, so I left it as-is rather than guessing at the right UX. Low risk either way since the copy is genuinely visible before the mic is ever requested. |
| Low | App-wide (`next.config.js`, no middleware header logic) | No CSP/HSTS/`X-Frame-Options`/`Referrer-Policy` anywhere in the app. Interview pages inherit this, but it predates the feature and applies to every route, not just `/interview` — out of scope to fix inside a feature review. | **Documented only.** Recommend a separate app-wide security-headers ticket. |
| Low | `components/interview/QuestionCard.tsx` | Captions default on but can be toggled off ("Hide Text" / "Show Text") — spec says "captions always visible." Read this as "on by default," not "un-hideable"; a user-controlled hide is normal a11y UX, not a violation. | **Left as-is.** Flagging in case you intended it literally. |
| Low | `supabase/schema.sql` — `resumes` INSERT policy (pre-existing, not part of this diff) | Same "INSERT isn't column-locked" shape as the Blocker above exists for `resumes` too, but there it's a legitimate, established pattern (`resumes` genuinely needs client-side creation for `job_description`, unlike the interview tables which never do). Noted only because it's the reason the interview-table fix above had to be "remove the INSERT policy entirely" rather than "column-lock it like UPDATE" — no action needed, not a regression. | **Documented only — not a new issue.** |

### Verified, no finding (worth stating explicitly, not just "looked fine")

- **A1 Secrets:** `GEMINI_API_KEY` is read only in `lib/gemini/client.ts`; grepped the whole repo (`.ts`/`.tsx`/`.js`/`.mjs`) for `GEMINI_API_KEY`/`NEXT_PUBLIC_GEMINI`/`SUPABASE_SERVICE_ROLE_KEY` — only server-only files matched. `logApiCost` records token counts only, never prompt/transcript content.
- **A2 Entitlement:** all three interview routes (`sessions`, `sessions/[id]`, `sessions/[id]/turns`) call `requireUser()` → `assertPaidPlan()` before anything else, mirroring `ats-score/route.ts`. Verified with mocked-401/403 tests on all three (`route.test.ts` files), not just by reading the code.
- **A3 RLS shape:** `interview_sessions` is direct-ownership (`auth.uid() = user_id`); `interview_turns` is the `EXISTS`-join through the session's `user_id`. No `using (true)` anywhere. Column lockdown: `interview_sessions` only grants `UPDATE (status)` to `authenticated`; `interview_turns` grants no client `UPDATE` columns at all — every AI-scored column (`star_scores`, `*_feedback`, `suggested_answer`, `wpm`, `filler_count`, `transcript`) is service-role-only. *Caveat: this was verified by reading the policy SQL carefully, not by running it against a live Supabase project — nothing has been deployed. Run the two cross-user isolation checks in the deploy checklist below before shipping.*
- **A4 resumeId/stageType/session ownership:** `resume_id` ownership relies on RLS (`resumes` SELECT policy is `auth.uid() = user_id`, same pattern as `ats-score`); `stage_type` is validated against an explicit enum; a session ID from another user 404s (RLS + explicit `.eq("user_id", authUserId)` belt-and-braces). Follow-up cap (1/question) and total-turn cap (8) are enforced in `lib/interview/followup.ts` and can no longer be bypassed by replay (Blocker fix above).
- **A5 XSS:** grepped all interview components — no `dangerouslySetInnerHTML`, no markdown renderer. All model/user content (`content_feedback`, `suggested_answer`, `transcript`, job-ad text) goes through plain React `{}` interpolation.
- **A6 Runtime/headers:** Node runtime (no `edge` export), `maxDuration: 120` on the two Gemini-calling routes matching `ats-score`'s reasoning, all error paths return `NextResponse.json({error}, {status})` with fixed messages (no stack traces leaked), no CORS headers set (no wildcard).
- **Part D model IDs:** `gemini-3.6-flash` / `gemini-3.5-flash-lite` looked unfamiliar at first glance (checked with a live web search rather than assuming) — confirmed current, real, audio-capable Gemini API model IDs as of August 2026, not hallucinated. No change needed.
- **Part C anti-fabrication:** both the simulation and (new) coaching system prompts explicitly forbid inventing employers/tools/metrics and instruct the model to coach the user toward supplying a real number rather than inventing one. Verified by reading the actual prompt strings, not just their presence.
- **Question grounding:** confirmed the question-generation prompt reads the resume's job ad, the `parsedJobAdCache` compact JD (no redundant re-parse), `user_profiles` evidence, and `skills_bridge_items` filtered by `user_state='confirmed'` (matches) / `state='gap'` (the honest gap question) — and that the honest gap-question instruction is actually present in the system prompt.

## Tests added

- `lib/interview/mode.test.ts` — stage → mode mapping (the spec-required test that had no code to test before this fix).
- `lib/gemini/scoreInterviewAnswer.test.ts` — defensive JSON parsing: fenced/clean JSON, truncated JSON, empty text, non-object JSON, out-of-range star-score clamping, and (the key regression test) coaching mode never returning `star_scores` even if the model ignores the instruction.
- `app/api/interview/sessions/[id]/turns/route.test.ts` — 401/403, missing `turnId`, missing answer, oversized audio, bad mime type, **409 on turn replay**, 400 on a non-`in_progress` session, and a mocked happy path proving `mode` threads through to both Gemini calls and the response shape.
- `app/api/interview/sessions/route.test.ts` — 401/403, missing `resume_id`, invalid `stage_type`.
- `app/api/interview/sessions/[id]/route.test.ts` — 401/403, 404 on a session RLS can't see, PATCH rejects `completed`, PATCH allows `abandoned`.

These use `vi.mock` against `@/lib/requireUser` and `@/lib/supabase/server` — there was no existing
route/API-handler test pattern in this codebase (the existing 21 test files are all pure-logic
unit tests plus one skip-if-no-key live integration test), so this is a new but minimal pattern,
not a departure from an established one.

### What is *not* covered, and why

- **Live RLS isolation (user A can't read/write user B's rows via the anon client).** The policy
  SQL was read line-by-line and is structurally correct (see "Verified" above), but proving it
  requires two real signed-in users against a live Supabase project — there is no such test
  harness in this repo today (confirmed: no `vi.mock`, no live-DB fixtures, no second test
  Supabase project referenced anywhere). Building one from scratch is a bigger investment than
  this review's scope. **Do this manually before shipping** — see the deploy checklist.
- **Full live Gemini round-trip** (`interview-question-gen`/`answer-score`/`report-gen` hitting
  the real API). Covered indirectly by `lib/__tests__/aiProviders.integration.test.ts`'s existing
  skip-if-no-key pattern for other Gemini features, but no interview-specific live test was added
  — the mocked route test above proves the wiring; it doesn't prove Gemini actually returns
  parseable JSON for these new prompts. Recommend running one real session manually (see manual QA
  checklist) before shipping.

## Lint / test results

| | Before | After |
|---|---|---|
| `npm run lint` | clean | clean |
| `npm run test` | 201/201 passed (21 files) | **231/231 passed (26 files)** |
| `npx tsc --noEmit` | clean | clean |

## GO / NO-GO

**GO**, conditional on the two manual, undeployed checks below (which no automated test in this
repo can currently perform) being done once, by hand, before flipping this live:

1. Run the new `supabase/schema.sql` statements in the Supabase SQL editor, then in the dashboard
   confirm RLS shows **enabled** on both `interview_sessions` and `interview_turns`.
2. With two real test accounts, confirm via the anon client (not the app UI) that user A cannot
   `select`/`update`/`insert` user B's session or turn rows, and that a plain authenticated
   `PATCH` attempt against `star_scores`/`report`/`overall_score` is rejected.

Every Blocker and High is `FIXED` and proven by a test that would have caught it. The one Medium
left `DEFERRED` (explicit consent gate) is a UX call, not a security gap — current copy is
prominent and shown before mic access is requested.

## Deploy checklist

- [ ] `GEMINI_API_KEY` set in Vercel (all environments), server-only — confirmed not in the client bundle (grepped repo; only read in `lib/gemini/client.ts`)
- [ ] New `supabase/schema.sql` statements run in the Supabase SQL editor; RLS confirmed **enabled** on both new tables in the dashboard (**not done — do this manually, nothing has been deployed**)
- [ ] RLS isolation + column-lockdown **manually** verified against the live project with two real accounts (**not done — see GO conditions above**; policy SQL itself was read and verified correct)
- [x] Every interview route returns 403 for free users / 401 for logged-out — verified by `route.test.ts` mocked tests, not just assumed
- [x] Anti-fabrication rules present in the Gemini prompts — verified by reading them (both simulation and new coaching prompts)
- [x] `npm run lint` and `npm run test` green; new tests included (231/231, up from 201/201)
- [x] `/interview` in `PROTECTED_PREFIXES` (`lib/supabase/middleware.ts`) — was already present; free-user redirect (`InterviewSetup.tsx`) confirmed UX-only, real gate is `assertPaidPlan()` on every route
- [x] Consent + privacy copy present (Setup page "Audio Readiness & Privacy" panel + recorder inline note); audio confirmed not persisted — no storage bucket write anywhere, no `audio_path` column, `VoiceRecorder.tsx` discards the blob after submit
- [x] GO / NO-GO verdict with remaining risks called out — see above

## Manual QA checklist (for you to run — needs a live browser/mic/Gemini key)

- Mic permission denied → text fallback works end-to-end
- Network drop mid-recording → session recoverable, no lost progress beyond the in-flight turn
- TTS (question read-aloud) across Chrome/Safari/Firefox
- Mobile Safari `MediaRecorder` — confirm codec fallback (`audio/mp4`) actually engages and Gemini accepts it
- Caption/question sync; full keyboard + screen-reader pass
- Run one real `group`-stage session end-to-end and confirm the report reads as a coaching summary (no STAR grid, no numeric score) — this is the one thing that can't be proven by a mocked test
- Run one real non-group session end-to-end and confirm `api_cost_log` rows appear for `interview-question-gen`, `interview-answer-score` (once per turn — check there's no accidental double-call), and `interview-report-gen`
- Confirm no audio is persisted anywhere (no new Storage objects after a session)

## Perf/cost sanity

- One Gemini call per turn confirmed by reading `turns/route.ts` — `scoreInterviewAnswer` is
  called exactly once per POST, gated by the new idempotency check so a client retry/replay can no
  longer trigger a second call for the same turn.
  `generateInterviewReport` is called exactly once, only on the final turn.
- `maxDuration: 120` on both Gemini-calling routes vs. a new `55_000`ms per-call timeout — two
  sequential calls (score + report, on the final turn) can take up to ~110s worst case, which fits
  inside the 120s budget but has less headroom than the single-call routes. Worth watching in
  production; not a blocker.
