# Pre-launch security to-do

Audit date: 2026-09-20. Everything not listed here was checked and is already done in code
(env handling, git history, admin routes, auth, permissions, input sanitising, XSS, SQL injection,
RLS, upload limits, CORS, most security headers, debug logging, key exposure).

## Do first: highest importance, easiest

- [ ] **Set spend caps in the provider consoles** (Anthropic, OpenAI, Gemini, Google Cloud TTS).
      No code. The per-user quotas and circuit breaker don't limit total account spend.
- [ ] **Verify production env vars in Vercel.** Live Stripe keys and price IDs (same mode as the
      secret key), real Turnstile keys (not the always-pass test keys), correct `NEXT_PUBLIC_APP_URL`,
      Stripe webhook secret for the live endpoint.
- [ ] **Confirm HTTPS on the custom domain** and that HTTP redirects to HTTPS (Vercel dashboard).
- [ ] **Add `Strict-Transport-Security` header** in `next.config.mjs` `headers()`, e.g.
      `max-age=63072000; includeSubDomains`. One line.
- [ ] **Same-origin check on mutating API routes** (POST/PUT/PATCH/DELETE): reject when the
      `Origin` header doesn't match the app URL. Skip the Stripe webhook and extension routes.
      Small shared helper, this is the CSRF protection.

## Next: important, a bit more work

- [ ] **Audit rate limiting.** Only 14 of 56 API routes call `checkAndRecordRateLimit`. Check the
      remaining AI/PDF routes (e.g. `generate-pdf`, `generate-docx`, `parse-job-ad`, `resume/[id]/*`)
      are covered by the free-tier limits, or add a limiter.

## Later

- [ ] **Full script-src CSP.** Needs an audited allowlist (Supabase, Stripe, Turnstile, analytics)
      and live testing. Currently only `frame-ancestors 'none'` is set.
- [ ] **Explicit cookie flags** (`secure`, `sameSite`) in `lib/supabase/*`. Supabase defaults are
      acceptable, so this is hardening only.
