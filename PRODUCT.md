# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Active job seekers, applying end-to-end right now: building/scoring resumes, generating cover letters, tracking applications, and prepping for interviews. In today's job market, users are applying to a high volume of similar roles (same function, different job title per posting), not one polished application at a time.

## Product Purpose

ApplyLab is an all-in-one job-application tool: resume builder and scorer, cover letter generator, application tracker, interview prep, and a browser extension, so a job seeker doesn't juggle separate disconnected tools for each step of applying.

## Positioning

Two things a neighboring resume-builder (Enhancv, Teal, Rezi, Huntr) can't both claim:
1. **All-in-one** — resume, cover letters, tracking, and interview prep live in one product instead of stitched-together tools.
2. **Automated tailoring at volume** — resumes/cover letters can be automatically tailored to a specific job ad, which matters because the current job market pushes seekers to apply to many similar roles (same underlying role, different title/company) rather than a handful of hand-crafted applications.

## Operating Context

- Web app (Next.js) plus a browser extension (`extension/`) that assists application/autofill workflows from job sites.
- Backend: Supabase (auth + Postgres), Stripe (billing/subscriptions), OpenAI + Anthropic APIs (resume/cover-letter generation, scoring).
- Has an admin surface (`app/(dashboard)/admin`) for analytics, feedback, and user management — an internal/ops audience in addition to job-seeker end users.
- Free and paid tiers exist (`pricing`, `upgrade` routes); entitlement-gated actions (e.g. cover letter creation) are enforced server-side, not just in the UI.

## Capabilities and Constraints

- Core surfaces: resume builder/editor, resume scoring, standalone cover letters, application tracker, interview prep, documents, browser extension, admin analytics/feedback/user management.
- Brand name is **ApplyLab**, styled lowercase (`applylab`) in code/UI — not "ApplyLet."
- Brand color is orange (no green) per the existing landing implementation.
- Push-to-main workflow, no feature branches; Vercel preview builds are expected to fail (missing `STRIPE_SECRET_KEY` in preview env) — not a regression signal.

## Evidence on Hand

No customer testimonials, logos, or case studies are currently committed in the repo/content — do not fabricate any for landing or marketing surfaces.

## Product Principles

1. Consolidate the whole application workflow instead of adding another single-purpose tool.
2. Optimize for volume: users are tailoring and sending many applications per role type, not perfecting one at a time — speed and automation matter as much as polish.
3. Keep entitlement/billing checks (free-tier caps, paid actions) server-enforced; never trust the client alone.
4. Preserve the existing orange, "ApplyLab" identity when refining — this is refinement of an incumbent product, not a rebrand.
