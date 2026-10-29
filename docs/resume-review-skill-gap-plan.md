# Resume review and Skill Gap

## Flow

Open review -> show three prioritised actions -> open one finding -> edit or answer a short question -> review wording -> explicitly apply -> undo remains available.

Job-specific evidence is supplementary: use only the resume's linked, owned Skill Gap analysis when its job-ad hash can be verified. Never treat missing evidence as proof the person lacks a skill. Keep development advice separate from wording fixes. General resumes remain useful without a job ad or questionnaire.

## Implementation

1. Move Start here ahead of score details; keep one finding expanded while retaining mounted drafts.
2. Load verified linked Skill Gap evidence server-side. Reuse confirmed answers; do not infer that a competency is absent from the resume through keyword matching.
3. Provide short inline Yes / No / Skip questions for unconfirmed items. Yes requires the person's own example. Save through the existing authenticated Skill Gap endpoint, with optimistic concurrency checks. No automatic resume or profile writes.
4. Show source evidence beside editable findings for the same unambiguous role. Wider additions still use the editor; guard navigation while wording is unsaved.
5. Offer optional career guidance without changing a quality score or pretending to assess an industry without an ad. Keep genuine gaps in Prepare for this role.
6. Add regression tests; inspect laptop and phone layouts with fictional fixtures. Review security, failure paths, draft retention and honesty. Run typecheck, lint, tests and production build; review the final diff before committing and pushing main.

## Compatibility

Older upload analyses hash both the ad and uploaded profile. Their job identity cannot be verified from existing rows alone, so do not reuse them until the user checks that target again. Store a separate job-ad fingerprint on new or reused analyses, with a best-effort metadata write so older databases retain their existing Skill Gap flow. The previous combined review-token SQL file now also adds this nullable fingerprint; it remains the only file to run.

## Live checks

Verify actual Supabase answer persistence and ownership, real AI wording, profile/upload flows and review refunds after applying the combined incremental SQL. Local fixture checks cannot verify these.
