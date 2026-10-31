# Resume builder: section completeness and writing help

## Goal
Make the builder useful from a blank resume as well as for edits, with short forms, optional detail, and AI suggestions the user reviews before applying.

## Initial comparison from code
- Projects: AddEntryDialog collects title, context and timeframe. Profile ProjectCard also collects description, tools, link, outcome and outcome_metric, and offers instant/guided AI help. projectFromProfile (lib/resume/addEntries.ts:109) uses tools only when context is empty, so tools disappear from the resume when both exist.
- Experience: the Add form collects role, company, dates and optional location, but no duties or achievements. The profile offers duties, wins and guided help. The canvas already has Suggest tasks and bullet improvement; extend these patterns instead of duplicating them.
- Education: the Add form already collects qualification, institution, dates/current study and notes. Preserve this parity and check discoverability when editing.
- Referees: the Add form already collects name, title, organisation, phone and email. Preserve this parity.
- Summary: no AI entry point exists. The resume assist route only handles bullet actions (rewrite, quantify, shorten, senior, trim_unsupported), so summary help needs a new endpoint.
- Project enhancement (app/api/projects/enhance/route.ts) instructs invented engineering benchmarks (rule 4), forces upgraded verbs (rule 2), and supplies fictional fallback context (lines 120-122, 161-171). It is also used by components/profile/GuidedProjectBuilderModal.tsx. Correct this before reusing the endpoint.

## Owner decisions
1. Summary AI: **one free use** on the free plan, unlimited on Pro. Use the existing free-tier pattern (`reserveFreeTierFeature` / `trackFreeTierReservation` with refund on failure) under a new feature key capped at 1.
   - Only a successful suggestion uses up the free try. A failed, cancelled or unparseable response is refunded.
   - Before the request, show "1 free use" on the button. After it's used, show an upgrade prompt instead of starting a request.
   - Write and Improve share the same single use.
2. Project help: change both the editor and the Profile page. GuidedProjectBuilderModal moves to the new plain questions (what was it, what did you do, what happened; tools and numbers optional). Update its request/response handling. One endpoint.
3. Uncommitted work (`lib/profile/getUserProfile.ts`, `package.json`, `tsconfig.json`, `.gitignore`, `scripts/zip_extension.mjs`) is finished. Build on it, but never stage it with this feature's changes.
4. Ship all phases together. No commit or push until the owner asks.

## Phases
Review the diff after each phase (AGENTS.md section 7).

### A. Honesty fix + lossless project conversion
- Enhance prompt: remove rule 4 (invented benchmarks), rule 2's forced verbs ("Architected", "Spearheaded") and the ban on plain phrasing, and every fictional default ("Developer / Architect", "General Stack", "Software Engineering Project", the invented problem/constraint/evidence fallbacks). Missing inputs stay missing. Achievements stay close to the user's own wording. Check every rule against AGENTS.md section 14.
- Replace the P-A-C-E engineering questions with plain ones: what was it, what did you do, what happened. Tools and metrics optional.
- projectFromProfile: tools join the context line alongside existing context (never drop either). Outcome (+ metric) becomes a bullet; link stays a bullet. No type or DB change: ResumeProjectEntry stays title/context/year/bullets.

### B. Add pop-up fields
- Projects: title first (only required field); short description readily available; contribution, timeframe, tools, link and outcome under More details. Map fields as in phase A. Make existing project details editable without deleting/recreating the project.
- Experience: optional duties/achievement notes during Add. Each line becomes a bullet exactly as typed, no AI rewrite on add. Keep inline bullet editing and existing Suggest tasks help.
- Keep existing Add buttons, the shared single-step pop-up, profile import and inline editing (AGENTS.md rule 13).

### C. Summary help (new endpoint)
- Show Write with AI when the summary is empty and Improve with AI when populated. The user can optionally give a target role and real notes/change request.
- Endpoint needs: entry in `MODEL_BY_FEATURE`, ownership check, free-tier reservation/refund (decision 1), `logApiCost`, `sanitizeDeep` and vendor-name stripping, `flagUnverifiedFacts` on the suggestion before it is shown, target title via `summaryTargetTitle`, and the career-changer framing rule (total career length, never "experience in" the target field).
- Define a clear "not enough facts" threshold; below it, return questions for the user instead of a summary.
- Show the suggestion with Apply and Keep mine. Never overwrite automatically.

### D. Project help in the editor
- Same endpoint and questions as phase A, opened from the canvas in a CanvasSheet. Preview before applying. No fabricated facts or upgraded claims.

## Shared behaviour
- Show the allowance before any AI request. Preserve drafts on failure, cancellation and quota exhaustion. Accepted changes go through existing undo/autosave.
- Stale responses: keep the source text from request time. At apply time, if the current text differs, show "Your text changed since you asked" with Try again, and don't apply.
- Server ownership and allowance enforcement on every AI request. Preserve PDF geometry/export behaviour.

## Implementation scope
- components/resume/canvas/AddEntryDialog.tsx and adjacent tests.
- Small summary/project help components using CanvasSheet rather than a new modal system.
- lib/resume/addEntries.ts and tests (including context + tools both present).
- app/api/projects/enhance/route.ts and components/profile/GuidedProjectBuilderModal.tsx, with prompt/request validation tests.
- New summary assist route, `MODEL_BY_FEATURE` entry, free-tier feature key, route tests.
- Shared types/sanitisation only if required. No database changes expected.

## Out of scope (follow-up)
- Contact and skills editing on the canvas: trace current canvas editing and data round trips separately before deciding which controls are missing.

## Claude/Codex split (AGENTS.md section 8)
- Codex: enhance prompt and request changes, summary endpoint, free-tier wiring, route tests.
- Claude: Add pop-up fields, summary/project help panels, Profile modal UI, browser checks.
- Continuation: the owner moved this work to Codex, which completed review fixes and local validation across both UI and backend.

## Friction and accessibility checks
- No forced wizard or required metrics; no automatic AI call or modal opening.
- Label all inputs; keyboard operation, focus return and dirty-close protection.
- Phone bottom sheet with pinned actions, scrollable content and readable input sizes.
- Preview never discards original content; stale AI responses cannot overwrite newer edits.

## Verification and acceptance
- Test conversion, draft preservation, AI preview/apply/cancel, blank facts, failed requests (refunded, free use not consumed), stale responses, the one-use quota and ownership handling.
- Run typecheck, lint, Vitest and production build; review the complete change for correctness and unnecessary code.
- Verify laptop and phone widths in a real browser. Creating a temporary real Supabase user requires owner permission under AGENTS.md section 5.
- Owner checks real persistence, live AI factual accuracy, the free-use counter in a real account, and live auth/network failure behaviour.
- Report split into Verified and Needs live check.

## Continuation review and validation

| Before | After | Why |
| --- | --- | --- |
| Summary suggestions could replace newer edits | Applying a stale suggestion is blocked; Try again returns to the form | Protect the user's latest writing |
| Summary generation used only the saved resume | The endpoint accepts and sanitises the current editor draft after checking ownership | Include facts still waiting for autosave |
| Closing project help could lose a contribution or result | Dirty checks cover every editable answer and pending requests | Avoid accidental input loss |
| Project suggestions had no stale-source check | Both profile and editor compare the source project before applying | Protect project edits |
| A metric without an outcome disappeared | Keep standalone metrics as a bullet; expose the optional metric in Add project | Preserve real user content |
| Exhausted summary allowance still sent a request | Show upgrade options without calling AI when the allowance is known to be zero | Make the single free use clear |
| Cancelled generation could keep a reservation | Refund requests whose cancellation is observed before completion | Keep cancellation consistent with the allowance |
| Current study was only represented by a date string | Supply structured education evidence to the summary fact checker | Do not reject valid in-progress study claims |

- Full suite: 206 files passed, 2 skipped; 1,962 tests passed, 15 skipped (`npx vitest run --maxWorkers=2`). The first default-concurrency run hit two Chromium cleanup timeouts; the reduced-concurrency rerun passed both PDF suites.
- Final focused feature suite: 92 tests passed across 6 files, including later review regressions.
- Final typecheck and lint passed; production build passed. Next reports an existing `react-hooks/exhaustive-deps` warning in `components/applications/AddApplicationModal.tsx:87`, outside this feature.
- Real Chromium component checks passed for summary, project help, Add project and the profile project writer at 1366x900 and 390x844. Checked screen bounds, absence of horizontal overflow, and preview/apply flows. APIs were mocked, with no Supabase writes or live AI calls. Local harness/screenshots: `.tmp/resume-help-browser.mjs` and `.tmp/resume-help-browser/` (ignored development artifacts).
- No migration. Preserve the unrelated pre-existing changes listed in Owner decisions. The owner subsequently authorised committing and pushing this feature after thorough review and checks.
- Remaining live checks: owner verifies authenticated editor integration, undo/autosave/reload persistence, factual live AI output, single-use counter/refunds and real network cancellation. The standalone browser harness does not verify those integrations.

## Pre-push review

| Before | After | Why |
| --- | --- | --- |
| Retrying stale project help reused old contribution text | Reload the latest project contribution before retrying in both profile and editor | Avoid overwriting newer facts with an outdated draft |
| Clearing a result/metric in profile help left the saved value intact | Pass explicit empty values through the project card | Make clearing a field work as expected |
| Closing during an account check could still start AI afterwards | Create the cancellation controller before the account check and verify it afterwards | Avoid unwanted requests and spent uses |
| A failed project usage lookup bypassed the hourly check | Stop before reserving or invoking AI if the lookup fails | Preserve cost controls during database failures |

- Added profile-card integration regressions for field clearing, stale retries, failed requests and closing during an account check.
- Added API regressions for authentication, explicit ownership filtering, invalid editor payloads, failed usage lookup and observed request cancellation/refunds.
- Added real ResumeEditor integration tests with mocked APIs: summary apply/autosave/undo/redo and project apply/undo.
- Repeated Chromium component checks at laptop and phone widths for all four panels; preview/apply and viewport bounds passed with no browser errors.
- Live Supabase-user creation still requires explicit owner approval under AGENTS.md section 5. No real test user or live AI call was made during this review.
- Final pre-commit checks passed: `npx tsc --noEmit`, `npm run lint`, `npm test -- --maxWorkers=2` (207 files, 1,979 tests passed; 2 files and 15 tests skipped), `npm run build`, and staged diff whitespace checks. The existing AddApplicationModal hook warning remains outside this feature.
