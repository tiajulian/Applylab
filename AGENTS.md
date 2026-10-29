# AGENTS.md — ApplyLab handoff for AI coding agents

Read this whole file before touching code. It holds the project context, the owner's working rules, and the
workflow that previous AI sessions (Claude Code) followed. The rules in "Hard rules" were each learned from a
real mistake; treat them as non-negotiable.

---

## 1. What the product is

**ApplyLab** is an all-in-one job-application web app for job seekers (mainly Australia, AUD pricing, en-AU
spelling): resume builder + editor + scorer, cover-letter generator, application tracker, interview practice,
job matcher, and a browser extension.

- Positioning: (1) all-in-one instead of stitched tools, (2) automated tailoring **at volume** — users apply to
  many similar roles, so speed and automation matter as much as polish.
- Core honesty principle: AI **selects and structures the user's real content; it never invents** facts,
  numbers, tools, or achievements. This applies to every prompt in the codebase.
- More context: [PRODUCT.md](PRODUCT.md) (product/users/principles), [DESIGN.md](DESIGN.md) (design system
  tokens — colours, type, spacing), [applylab-implementation-brief.md](applylab-implementation-brief.md),
  [docs/](docs/) (security to-do, rate-limiting report, interview review).

### Brand

- Name is **ApplyLab** (never "ApplyLet"). User-facing copy: `ApplyLab`. Lowercase `applylab` only for code
  identifiers, data keys, domains (`applylab.au`).
- Brand colour is orange (accent `#B74F15`, logo orange `#D76225`). No green as a brand colour.
- Support email: `applylab.support@gmail.com`.
- Don't fabricate testimonials, logos, case studies, or stats on marketing pages — none exist.

---

## 2. Tech stack

| Area | Tech |
|---|---|
| Framework | Next.js 15.5 (App Router), React 19, TypeScript, Tailwind 3 |
| Node | `>=22 <25` |
| DB / Auth / Storage | Supabase (Postgres + RLS, `@supabase/ssr`), pgvector for job matching |
| Payments | Stripe (Pro A$29/month, A$59/3 months, single resume unlock; Stripe Tax on) |
| AI | Anthropic (Claude Sonnet/Haiku), OpenAI (gpt-4o-mini, GPT-5.6 Luna, `text-embedding-3-small`), Google Gemini (flash / flash-lite), Google Cloud TTS (interview voice) |
| Email | Resend |
| Captcha | Cloudflare Turnstile |
| Rate limiting | Postgres advisory-lock limiter, optional Upstash Redis |
| Analytics | PostHog (EU, production builds only) |
| PDF | Puppeteer + `@sparticuz/chromium` on Vercel; DOCX via `docx` |
| Parsing | `pdf-parse`, `mammoth` |
| Tests | Vitest + Testing Library + jsdom |
| Hosting | Vercel (Production deploys from `main`), daily cron `/api/cron/ingest-jobs` at 18:00 UTC |
| Extension | `extension/` — separate Vite build (Chrome MV3, content/background/sidepanel) |

### Commands

```bash
npm run dev            # local dev on :3000
npm run build          # production build — run this before any commit, not just Vercel's
npm run lint
npm test               # vitest run
npx tsc --noEmit       # typecheck
npm run build:extension        # build + zip extension
npm run build:extension:store  # store-ready zip
```

Env vars: see [.env.example](.env.example) (names + comments). Real values live in `.env.local` (never commit,
never print, never send anywhere) and in the Vercel dashboard.

---

## 3. Codebase map

```
app/
  (auth)/          login, signup, forgot/reset password
  (dashboard)/     logged-in app: resume, cover-letter, applications, interview, job-matcher,
                   documents, profile, extension, admin, dashboard
  (print)/         print layouts (interview report)
  api/             route handlers (resume, generate-*, stripe, cron, extension, public, admin …)
  onboarding/, accept-terms/, pricing/, upgrade/, resume-score/ (public scorer), blog/, faq/, legal pages
components/        UI by feature (resume/, templates/, interview/, jobMatcher/, marketing/, ui/ …)
lib/
  anthropic/       Claude prompts + calls (generateResume.ts has RESUME_SYSTEM_PROMPT), models.ts
  openai/, gemini/, googleTts/
  aiGateway/       per-user AI credit gateway + circuit breaker (cost control)
  resume/          resume editor logic: reducer, sanitising, scoring, fact-check, fit-to-PDF, templates
  review/          resume review rules/blocks
  pdf/             PDF geometry (pageGeometry.ts — A4 sizes), export
  export/          DOCX export
  supabase/        server/client/middleware helpers
  stripe/          client + fulfilment (webhook logic)
  rateLimit*.ts, limits.ts, turnstile.ts, requireUser.ts, security/
  jobs/, places/   Adzuna job ingest + matching, AU place geocoding
  interview/       interview practice session flow
types/index.ts     shared types
supabase/
  schema.sql       full schema (NOT idempotent — see rules)
  migrations/      incremental migrations, timestamped
extension/         browser extension source
scripts/           ingest-jobs, load-au-places, render-templates, loadtest, stripe price scripts
middleware.ts      auth + onboarding/terms redirects
```

### Key design facts

- **Model routing**: [lib/anthropic/models.ts](lib/anthropic/models.ts) `MODEL_BY_FEATURE` is the single
  source of truth for which provider/model each AI feature uses. Call sites read from it; cost logging uses the
  same entry. Changing a provider = edit the entry AND the call site's client.
- **Entitlements are server-enforced.** Free-tier caps, paid actions, AI credits — never trust the client.
- **Resume editor canvas = true A4 PDF geometry.** Editor ([components/resume/ResumePreviewPane.tsx](components/resume/ResumePreviewPane.tsx)),
  popup preview, and PDF all share `lib/pdf/pageGeometry.ts`. The PDF auto-fits via a trim ladder; the editor
  copies only the fitted font/spacing + page count. **When fixing editor display bugs, never change PDF export**
  — the owner says the export is correct.
- **Never cut the user's content to fit a page** (recent commit) — fitting may tighten spacing/font, not
  silently drop content the user wrote.
- **Uploaded general resume opens exactly as written** — don't rewrite the user's uploaded text on import.
- **Score caching**: scores are cached by content hash. All score readers/writers must hash through
  `lib/resume/resumeScoreHash.ts` (section order is layout, so reordering never stales a score).
- AI vendor names must not leak into user output (`stripAiVendorMentions.ts`).
- Middleware redirects users without `onboarded` / current `accepted_terms_version` to `/onboarding` /
  `/accept-terms`.

---

## 4. Hard rules (owner's standing instructions)

### Git & deploy
1. **Never commit or push unless the owner explicitly asks in that request.** "Fix X" is not permission to
   commit or deploy. Pushing to `main` deploys to production. If a fix needs a deploy, stop and ask.
2. When asked to push: **commit straight to `main`**, no feature branches. Branch pushes trigger Vercel Preview
   builds, which always fail (Preview has no `STRIPE_SECRET_KEY`) — that failure is expected, not a regression.
3. The working tree often contains the owner's unrelated uncommitted work. Don't discard, stash, reset, or
   include it in your commit without asking. Stage only the files you changed.
4. Commit style: Conventional Commits with a scope and plain-English subject, e.g.
   `fix(resume): keep an uploaded resume's title line under the name`,
   `feat(interview): practise from a job ad alone`. Types used: feat, fix, chore, copy, test, docs.

### Quality bar
5. Write the simplest, cleanest, most efficient code that works. No premature abstraction, dead code, or
   redundant logic. Match surrounding naming, comment density, and idioms.
6. **Before every commit (even tiny ones):** re-read the full diff hunting for bugs (logic, edge cases, types),
   then run `npx tsc --noEmit`, `npm run lint`, `npm test`, and `npm run build` locally.
7. **After every feature/phase, do a full code review of the uncommitted diff, fix findings, then commit.**
   Don't wait to be reminded. For billing/Stripe/payments/entitlement code, review deeply: a shallow review
   once passed pricing work that a deep review then found ~10 real bugs in (webhook retries, duplicate
   subscriptions, charging for free resumes).
8. Write/extend Vitest tests next to the code (`*.test.ts(x)` beside the file).

### Honest reporting
9. Always split your report into **"Verified"** (typecheck/lint/build/tests/code reading) and **"Needs your
   check in a live environment"** (real Supabase persistence, live AI output, auth/ownership via real API,
   Stripe, network failure paths). Never imply untested behaviour works. Phrase the second list as things the
   owner needs to do.

### Communication
10. Keep replies short and simple. Include concrete specifics (file:line, facts), cut the padding.

### UI/UX — every feature
11. Every feature gets real UX design, not just working code: sketch the flow first, run a friction check
    (extra clicks, lost input, discoverability, phone keyboard / bottom sheets), follow [DESIGN.md](DESIGN.md)
    tokens, stay consistent with existing patterns, check mobile + accessibility (focus, labels, contrast,
    keyboard), and verify in a real browser at laptop and phone widths before calling it done.
12. Users are job seekers — copy must be plain and easy to understand. New features must not disrupt existing
    pages.

### Resume editor "Add" pop-up rules (agreed design)
13. Existing Add buttons keep their place and name but open a pop-up instead of inserting a blank entry.
    Editing existing content stays inline on the canvas.
    - Multi-field items (role, project, qualification, referee) → pop-up. One-line items (bullet, skill, tool) → inline.
    - One shared pop-up shell (same title/tab/button layout). Single step. Only title required; extras under
      "More details". "Save and add another". Multi-select "From my profile" tab (auto-picked; tabs hidden if
      nothing to import).
    - Backdrop click doesn't close once dirty; Esc confirms. Autofocus, Enter submits, focus returns to trigger.
    - After adding: scroll to + highlight the new item, inserted in date order.
    - Phone: content-height bottom sheet with pinned header/footer.
    - AI help never auto-opens a modal; show free uses before starting. All changes go through editor
      undo/autosave. "Save to profile" ticked by default.

### AI prompt discipline (generateResume.ts RESUME_SYSTEM_PROMPT, cover letter, scoring, etc.)
14. Every new prompt rule must hold the "never invent / never upgrade" line. Check each rule for:
    - **Framing that implies more than the fact** — e.g. a career changer's 15 years in retail is "total career
      length", never "experience in" the target field.
    - **Claim drift when rewording** — real achievements must be stated close to how the candidate described
      them, never reworded into a bigger/different claim. Say so explicitly in the rule.
    - **Structure vs length budget** — a required structure must actually fit its word/line budget for the
      hardest case (thin-experience candidates), not just the average.

### Database (Supabase)
15. **`supabase/schema.sql` is NOT idempotent** (`create policy` has no `IF NOT EXISTS`). Never tell the owner to
    re-run the whole file on the existing DB. For schema changes, write a new timestamped file in
    `supabase/migrations/` and hand over only the new incremental statements (`add column if not exists`,
    grants, etc.). Also append the change to `schema.sql` so it stays the full picture for fresh DBs.
16. Destructive statements (`drop … if exists`, `revoke`, `drop not null`) can get blocked by tool
    confirmation; apply additive statements first, then destructive ones as separate small migrations. Verify
    afterwards with a `select` on `information_schema`.
17. RLS on every user table; service-role key only server-side.

### Production config (Vercel / Supabase / Stripe)
18. Before deleting or overwriting anything in production: list the target and confirm its exact scope, say
    what will happen in production, change **one** item, verify production, then do the rest. A request for a
    change is permission for that change only, not its side effects.
19. **`vercel env rm NAME preview` deletes a shared variable from ALL environments, including Production** (this
    happened and nearly broke prod). To remove from Preview only, untick Preview in the Vercel dashboard. After
    any env change, re-list Production env vars immediately.

### Windows environment gotchas
20. Owner is on Windows 11 (PowerShell + Git Bash). Bash heredocs mangle quotes and regex escapes (`\b` became a
    backspace char). For multi-line edit scripts, write the script to a file and run it; after regex edits,
    check for stray control characters. Git Bash rewrites `/`-leading args into paths — use `MSYS_NO_PATHCONV=1`.
21. Files have LF/CRLF warnings — harmless, ignore.

---

## 5. Local testing of logged-in pages

Turnstile captcha fails on localhost, so normal signup/login can't reach dashboard pages locally. What works
(**ask the owner first each time — it writes to the real Supabase project**):

1. With the service-role key, `auth.admin.createUser` a throwaway user with an email starting `claude-ui-check-`
   (or similar clearly-throwaway prefix).
2. Upsert its `users` row with `onboarded: true`, `accepted_terms_at`, `accepted_terms_version = TERMS_VERSION`
   (from `lib/terms.ts`), otherwise middleware redirects.
3. `auth.admin.generateLink({ type: "magiclink" })` → `verifyOtp({ type: "magiclink", token_hash })` through
   `@supabase/ssr` `createServerClient` with a cookie jar → real `sb-<ref>-auth-token` cookies → load into
   Playwright storageState.
4. Set localStorage `applylab_feature_tour_completed=true` to skip the tour.
5. Captcha-gated routes work locally if the dev server is started with Cloudflare always-pass test keys as
   process env: `NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA`,
   `TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA`.
6. Test resume PDF: `.playwright-mcp/Customer-Experience-Coordinator-resume.pdf`.
7. **Delete the throwaway user afterwards.**

Other tips: if the owner's `next dev` is already running on :3000, don't kill it — run a second server on
another port (e.g. 3100). Pages never reach "networkidle" (use load + a short delay). Supabase bulk inserts null
out keys missing from some rows, so give every seeded row the same keys. `/api/generate-resume` with
`{mode:"general"}` needs no captcha (costs one AI call).

---

## 6. Tools & skills previously used (Claude Code)

The previous agent had these. If your tool lacks them, follow the same intent manually.

| Skill / tool | What it did | Do this instead if unavailable |
|---|---|---|
| **code-review** (low→max effort) | Reviewed the uncommitted diff for correctness bugs after every phase and before every commit | Do a deliberate bug-hunting review of `git diff` yourself; go deep on money/auth code |
| **simplify** | Cleanup pass: reuse, simplification, efficiency | Re-read the diff for duplication/over-engineering |
| **security-review** / web-security-audit | OWASP-style audit (RLS, Stripe webhook, CSP, keys) | See [docs/pre-launch-security-todo.md](docs/pre-launch-security-todo.md) |
| **impeccable** (+ subagents in `.claude/agents/`) | Frontend design: critique, polish, audit, harden, typography, layout. A hook runs its detector after UI edits | Skill files are readable at `.claude/skills/impeccable/` and `.agents/skills/` — read `SKILL.md` + `reference/` and follow them; DESIGN.md is its output |
| **emil-design-eng, apple-design, animate, review-animations, improve-animations, mobile-native, ask-sonner** | UI polish, motion, mobile-native feel (from `emilkowalski/skills`, see `skills-lock.json`) | Read the `SKILL.md` in `.claude/skills/<name>/` |
| **Playwright MCP** (`.mcp.json`) | Drove a real browser for live checks/screenshots | Use Playwright directly (`npx playwright` / playwright-core) |
| **Supabase MCP** | Ran SQL, applied migrations, read logs/advisors | Supabase dashboard SQL editor / Supabase CLI (`supabase/config.toml` exists) |
| **Stripe MCP** | Read/inspect Stripe objects | Stripe dashboard / CLI |
| **claude-api** | Reference for Anthropic SDK/model IDs | Anthropic docs |

`.claude/settings.json` has hooks that run the impeccable design detector after edits to UI files — not
required for other tools.

---

## 7. Standard workflow per feature

1. **Understand**: read the relevant code + PRODUCT.md/DESIGN.md. For UI, sketch the flow and run the friction
   check before coding. For big/ambiguous work, propose a short plan and get the owner's OK.
2. **Build** in phases, matching existing patterns. Add/extend tests.
3. **Verify**: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`. For UI, check in a real browser
   at laptop + phone widths (see §5).
4. **Review**: full bug-hunting review of the diff; fix findings.
5. **Report** (short): what changed (file links), Verified vs Needs-live-check lists, any migration SQL the
   owner must run (incremental only).
6. **Commit/push only when asked** → straight to `main`, only your files, Conventional Commit message.

---

## 8. Current state (as of 2026-10-29)

- Launch-ready product; recent work: uploaded-resume tailoring, general resume from profile/upload/scratch,
  editor Add pop-up + Suggest tasks, PostHog analytics, pre-launch security/QA fixes, Next 15.5/React 19 upgrade.
- **Uncommitted work in progress** in the tree (~32 files): score hashing moved to `resumeScoreHash` so section
  reordering doesn't stale scores; editor toolbar / template / custom-section changes
  (`lib/resume/customSections.test.ts` new); review rule tweaks; interview session flow; extension zip script.
  Don't revert it — ask the owner what state it's in before building on it or committing it.
- Open items in [docs/pre-launch-security-todo.md](docs/pre-launch-security-todo.md): provider spend caps,
  verify production env vars (live Stripe keys, real Turnstile keys, `NEXT_PUBLIC_APP_URL`), HTTPS redirect;
  later drop the old `rate_limit_hits` table.
- AI cost controls (`AI_GATEWAY_LIVE_ENFORCEMENT`, `AI_BREAKER_*`) — see `lib/aiGateway/gateway.ts` checklist
  before enforcing.
- Job Matcher: Adzuna ingest via daily Vercel cron; setup in [README.md](README.md).
