# Rate limiting: current state and open questions

Prepared 2026-09-21 for a system-design review. Based on reading the code only. Nothing here was
load-tested, and the Supabase and Vercel dashboard settings were not inspected.

Stack: Next.js on Vercel (serverless), Supabase (Postgres, auth), Anthropic / OpenAI / Gemini /
Google TTS for AI, headless Chromixum for PDF export, Stripe, Cloudflare Turnstile.

## 1. What exists today

Three separate layers protect against overuse. They are not coordinated.

| Layer | What it does | Where |
|---|---|---|
| **A. Request rate limiter** | Counts hits per key in a Postgres table (`rate_limit_hits`) within a time window. Over the limit returns an error. | `lib/rateLimit.ts` |
| **B. Per-user feature caps** | Lifetime caps on free users (e.g. 2 resumes, 2 cover letters, 10 assists per resume). Pro users are uncapped by count. | `lib/requireUser.ts` (`FREE_TIER_FEATURE_LIMITS`) |
| **C. AI credit gateway** | Reserves and commits "credits" per AI call. Free: 40 credits lifetime. Pro: 2000 per month (1 credit = $0.001). | `lib/aiGateway/`, tables `tier_quotas`, `ai_usage_ledger` |

Also present: Turnstile CAPTCHA on the two public/upload endpoints, and a "circuit breaker" that
measures AI spend velocity (`lib/aiGateway/circuitBreaker.ts`).

### Routes that use the request rate limiter (14 of ~57 API routes)

| Route | Limit | Key |
|---|---|---|
| `parse-job-ad` | 10 / minute | user |
| `profile/parse` (file upload) | 6 / 10 min | user **and** IP |
| `public/score-resume` (anonymous) | 4 / 24 h | IP |
| `skills-bridge` | 10 / hour user, 15 / hour IP | user and IP |
| `generate-cover-letter`, `cover-letters`, `applications/[id]/followup`, `resume/[id]/review` | 15 / hour each | user |
| `profile/extract-skills`, `copilot/generate-answer` | 30 / hour | user |
| `interview/turns/[id]/audio` (TTS) | 60 / hour | user |
| `projects/enhance` | 15 / hour | user |
| `role-duties`, `role-duties/generate-achievements` | 10 / hour, 20 / hour | user |

Four of these (`copilot`, `projects/enhance`, `role-duties`, `generate-achievements`) do not use the
shared helper. They each count recent rows in their own tables, so the logic is duplicated.

## 2. Routes with no request rate limiter that cost money or resources

These rely only on layer B or C, or on nothing beyond login and plan checks.

| Route | Cost | What protects it now |
|---|---|---|
| `generate-pdf` | Headless Chromium, 60 s, memory-heavy | Login + export entitlement only. **No limit at all.** |
| `generate-docx` | CPU | Login + export entitlement only. |
| `generate-resume` | AI, up to 120 s | Free: 2 resumes lifetime. Pro: not confirmed to be capped. |
| `resume/[id]/assist` | AI | Free: 10 per resume. Pro: not confirmed. |
| `resume/[id]/score`, `content-score` | AI | Paid plan, or 1 per resume on free. |
| `interview/sessions`, `interview/sessions/[id]/turns` | Gemini audio, up to 120 s | Paid plan only. 8-turn cap per session. No per-user request limit. |
| `win-polish`, `win-starters` | AI | Free: 15 lifetime each. Pro: uncapped by count. |
| `stripe/checkout`, `stripe/portal` | Stripe API calls | Login only. |
| `feedback` (POST), `account/*` | DB writes | Login only. |

## 3. Problems with the current implementation

1. **Not atomic.** The limiter reads the count, then inserts a hit. Concurrent requests can all
   read "under the limit" and all pass. A burst of parallel requests overshoots the limit.
2. **Fails open.** If the database query errors, the code logs and lets the request through.
3. **Table growth.** No cleanup job for `rate_limit_hits` was found in the migrations. Every
   limited request adds a row.
4. **Two extra DB round trips per limited request**, on the same database the app depends on.
5. **Shared fallback bucket.** `public/score-resume` falls back to the IP `127.0.0.1` when
   `x-forwarded-for` is missing, so all such traffic would share one bucket.
6. **Circuit breaker only reports.** It is read by the admin dashboard only. Nothing calls it on
   the request path and nothing acts on it automatically (no kill switch). Its baseline numbers
   (50 calls / $0.50 per 15 min) are guesses.
7. **Quota numbers are placeholders.** The migration itself says the free and Pro credit values
   are not based on real usage data.
8. **Not every AI route is on the gateway yet.** The migration notes that routes not yet ported
   only log to `api_cost_log` and have no credit cap.
9. **No limit on concurrency.** Many routes allow 120 s runs. One user can hold many at once.

## 4. Potential blockers

1. **Anonymous accounts can sidestep per-user limits.** The app signs visitors in anonymously
   (`lib/onboarding/ensureAnonymousSession.ts`). If each anonymous session gets its own free
   quota, a script can create accounts repeatedly. Whether production Supabase has CAPTCHA or an
   IP limit on anonymous sign-in is **not verified** (the local `config.toml` has CAPTCHA commented
   out). Per-user limits are only as strong as account creation is expensive.
2. **Choice of where limits live.** Postgres (current) is simple but slow and not atomic. Options
   are an atomic Postgres function, a Redis-style store (Upstash / Vercel KV), or Vercel's
   firewall rate-limit rules. Which are available depends on the Vercel plan, which I did not check.
3. **No usage data to set numbers from.** The limits need a business decision (how much abuse to
   tolerate, what Pro users may do) and there is no production traffic data in the repo.
4. **Provider spend caps are outside the code.** A hard monthly cap in the Anthropic / OpenAI /
   Gemini / Google Cloud consoles is the only real ceiling. Not verified.
5. **Client IP trust.** The code reads the first `x-forwarded-for` value. This is believed safe on
   Vercel, which sets the header, but it was not tested.

## 5. Suggested minimum before launch (for discussion)

1. Hard spend caps at each AI provider (no code).
2. CAPTCHA or an IP limit on anonymous sign-in, and a decision on whether anonymous users get a quota.
3. A rate limit on `generate-pdf` and `generate-docx`, and a per-user limit on interview routes.
4. Make the limiter atomic (one SQL function) and add a purge job for old hits.
5. Cap Pro usage by count or credits on every AI route, not just free.
6. Wire the circuit breaker to something that acts on "critical" (alert or temporary block).

## 6. Questions for the system designer

- Keep Postgres for limiting, or move to Redis / Vercel firewall? What fits the expected traffic and plan?
- Should limits be per user, per IP, or both, and what about anonymous users?
- What should Pro users be capped at, and should the cap be by request count or by cost?
- Should the system degrade automatically (block or queue AI calls) when spend spikes?
- Do we need per-user concurrency limits for the long-running routes?
