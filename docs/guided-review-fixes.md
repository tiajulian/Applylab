# Guided review fixes

Scope agreed on 30 October 2026: preserve current card counts. Prepare the missing-metric and fact-check guides without restoring those cards to the analyzer. No database changes.

## Inventory before implementation

Examples below are existing repository fixtures unless labelled illustrative. They are not claims about a live user's resume. Reasons come from `lib/review/rules.ts`, `lib/resume/contentChecks.ts` and `lib/resume/integrityChecks.ts`; role indices are removed from rule IDs.

| Rule ID | Current reason | Example | Guide / fallback |
| --- | --- | --- | --- |
| `style.jobAd` | `'technical solutions' is common in job ads. Name the work or result it describes.` | User-provided: “Collaborated with analysts and business stakeholders to understand data requirements and translate them into technical solutions” | Output question; up to three artefacts from the matching profile role |
| `style.jobAd`, `style.buzzword` (scope variant) | `'end-to-end' is common in job ads. Name the stages you owned instead.` | “Delivered end-to-end solutions for stakeholders” | Scope question; stages from matching role |
| `style.buzzword` (cliché variant) | `Buzzword: 'team player'. Show this with a specific action or result.` | “Team player who cut report time using dbt.” | Evidence question; custom wording only |
| `style.buzzword`, `style.jobAd` (other phrases) | `'…' is common in job ads. Name the work or result it describes.` | Illustrative: “Improved operational efficiency” | Work/result question; custom wording |
| `style.passive` | `Passive voice: lead with what you did` | “Reports were completed on 15 occasions each quarter.” | Action question; custom wording, preserving who performed the action |
| `style.weakOpener` | `Lead with what you did ('Ran', 'Built', 'Fixed'), not the duty` | “Responsible for the monthly reporting pack that went to the executive team and the board.” | Action question; custom wording rather than upgrading responsibility |
| `spelling` with no dictionary suggestion | `Possible spelling mistake: '…'` | Illustrative unknown word: `qzxqzx` (actual suggestions depend on dictionary) | Existing fallback |
| `style.dash` if sanitisation yields an empty replacement | `Long dashes can trip up hiring software: use a comma or hyphen` | Illustrative dash-only writable custom item | Existing fallback; normally has a replacement |
| `integrity.company-placeholder` | `"abc - sydney" looks like a placeholder employer` | `abc - sydney` | Employer-name question |
| `integrity.company-cutoff` | `Employer name "Acme - s" looks cut off` | `Acme - s` | Employer-name question |
| `integrity.company-spelling` | `Employer spelled two ways: "Commbank" vs "Combank"` | Same Financial Crime Analyst role with those two employers | Correct-name question |
| `integrity.dates-missing` | `Employment dates are missing or incomplete` | Empty start date and `-` end date, or `January 2020` with no end | Existing composite date-edit fallback |
| `integrity.dates-future` | `Start date is in the future` | `2030` to `Present` | Confirm / edit |
| `integrity.dates-order` | `End date is before the start date` | `2022` to `2020` | Existing composite date-edit fallback |
| `integrity.no-bullets` | `Role has no bullets` | Analyst at Acme Bank with `bullets: []` | Existing fallback; adding bullets is structural |
| `integrity.duplicate-role` | `Duplicate role entry` | Financial Crime Analyst repeated at Commbank / Combank | Existing fallback; removing a role is structural |
| `integrity.chronology` | `Roles aren't in reverse-chronological order` | `2015–2016` role before `2019–2020` role | Existing fallback; requires reordering |
| `integrity.many-current` | `3 roles are marked as current` | Engineer, Analyst and Barista all marked `Current` | Confirm / edit |
| `integrity.tense` | `Current role written in the past tense` | “Extracted 5 datasets.” / “Engineered 2 pipelines.” in a current role | Confirm / edit; completed work can legitimately use past tense |
| `integrity.overclaim` | `"Expert" may overclaim` | “Expert in AML monitoring.” | Confirm / edit |

Mechanical company/title/bullet/summary casing and title-typo findings already carry replacements. The guide selector deliberately leaves those suggestions unchanged.

## Findings that do not currently produce panel cards

- `integrity.company-missing`, `integrity.title-missing`, `integrity.project-empty`, `integrity.project-untitled`: their target block is empty, so `integrityItems` drops them. They retain their existing handling elsewhere.
- `integrity.name-case`, `integrity.no-linkedin`, `integrity.location-partial`: no target supplied; not panel cards.
- `integrity.no-metrics`: reason “Consider adding scope or outcomes”, example bullets “Did a thing.” / “Did another.” / “Did a third.”; no target supplied. Number guide prepared, tested, and not emitted. It appends only the user's number and context, never invents a figure or unit.
- `factCheck.ts` returns `FactCheckFlag` objects, not rule IDs or `after` values. These cover missing roles/projects, changed employer/title/date/project/qualification/institution, unknown referees, unsupported figures, claims attributed to another role, unsupported summary status, unknown skills/tools, and unconfirmed bridge claims. Example message: `The figure "65%" doesn't appear in what you provided for this role. Check it's accurate before exporting.` The analyzer explicitly excludes these flags. A `factcheck.*` confirm guide is prepared only for a future flag-only fix item.
- `provenance.new_claim` is deliberately suppressed. `provenance.reworded` carries current non-empty block text as `after` and is informational rather than a flag-only card.
- AI and deterministic score findings are a separate pipeline; they are not converted into this panel's `ReviewItem` objects. Shared deterministic passive/buzzword questions now use the same copy, without scoring changes. This checkout already used plain verbs in its example fix text; no `Spearheaded` example remained in `scoreReview.ts`.

## Implementation and UX

Question → choose grounded wording or “Something else” → inspect the existing WordDiff → Apply fix → existing Undo. Confirm cards use the existing keep/edit decisions. No modal, AI call, automatic content change or separate apply path.

Answers remain in panel state across card navigation and are invalidated when that block changes. Undo clears the answer. Switching to the full editor carries the draft forward. Unknown rules and cards that already have suggestions use the old rendering.

Only an exact company-and-title profile role match supplies artefact/stage chips. Tools from other roles or the job ad are not borrowed. Empty evidence means no padded chips. The user confirms their wording by choosing it and applying the preview. Action chips are deliberately conservative: a fixed “Led” could upgrade “Assisted”.

`copy.ts` already labels fixes “Keep as is”, so no copy change was needed there. Number keys select up to four visible options; A/K/E/S retain their existing actions. Inputs do not trigger those shortcuts. Ordering changes only: verification/integrity, metrics, vague wording, then minor style; counts and the skipped-last rule remain intact.

## QA follow-up (30 October 2026)

The deeper review reproduced and fixed these issues:

- Opening Review could select a reworded-only informational item instead of an actionable card. The editor now uses the same next-card queue as the panel.
- Composite date fields could open a text form that could not save them. Edit now focuses the real canvas date field (and its existing mobile editor); unsupported whole-block saves are rejected.
- Undo after a later canvas edit could announce success and leave the panel waiting for a card that would never return. Stale Undo now refuses to overwrite later work and explains how to proceed, both visually and in the live region.
- A passive phrase such as “Was trained” could offer “Trained”, reversing who did the work. Action wording now comes from the candidate rather than that inference.
- Marker-only custom answers could remove visible content, and unclosed custom formatting could affect following text. Empty visible answers are refused and replacement formatting is contained.
- Inherited object properties could bypass the unknown-rule fallback. Registry lookups now require an own property; malformed offsets are refused for text and number guides.
- The development demo could restore the answered suggestion rather than the original flag-only card after Undo. It now restores its original fixture.

Added real `ResumeEditor` tests for grounded choices, role isolation, autosave payloads, exact markup restoration, stale Undo and source-field editing. A 256-case formatting matrix verifies surrounding text and styles remain intact.

With the owner's explicit approval, Chrome also exercised the real logged-in editor against Supabase using a temporary synthetic account and resume, at 1440px and 390px. Grounded chips, number-key selection, input typing, real saves, exact Undo and persistence after reload passed. A simulated 503 save failure remained unsaved in the database, surfaced an error, and then saved successfully on retry. An unauthenticated save returned 401. The test account and cascading resume data were deleted and their absence verified. No AI generation, scoring, payments or export was invoked.

Screenshots: `.playwright-mcp/guided-review-live/1440-preview.png` and `390-preview.png`. This was browser viewport emulation, not a physical-phone test or a deployed-production UI check.

Final verification: 1,857 tests passed, 15 skipped (199 passing files, two skipped); TypeScript, lint, production build and `git diff --check` passed. The build retained the existing unrelated `AddApplicationModal.tsx` hook-dependency warning. Temporary test scripts and server workspaces were removed.

## Files

- `lib/review/guides.ts`: registry, grounded options, safe span replacement, existing-item adapter, ordering priority.
- `lib/review/guideCopy.ts`: shared question wording without importing the full registry into content checks.
- `ReviewCard.tsx`: answer controls, live suggested preview, disabled empty apply and draft-preserving full edit.
- `ReviewPanel.tsx`: answer state, keyboard options, exact role grounding, priority ordering and existing decision/undo wiring.
- `ResumeEditor.tsx`: passes the current content and profile to the panel.
- `lib/review/progress.ts`: applies the same priority to the next-card queue.
- `contentChecks.ts`, `scoreReview.ts`: share question wording; scoring calculations unchanged.
- `ReviewPanelDemo.tsx`, `app/dev/review-panel/page.tsx`: `?guided=1` opens a flag-only example in the existing development preview; unavailable in production.
- `guides.test.ts`, `ReviewCard.test.tsx`, `reviewPanel.test.tsx`: grounding, empty/stale answers, markup, metric safety, preview, apply/undo and keyboard coverage.
- `contentChecks.test.ts`, `buzzwords.test.ts`, `ResumeEditor.review.test.tsx`, `BulletImproveMenu.test.tsx`, `BaseResumeTemplate.test.tsx`: update assertions for the requested shared wording.
