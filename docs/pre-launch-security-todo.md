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
- [x] **Add `Strict-Transport-Security` header** in `next.config.mjs` `headers()`, e.g.
      `max-age=63072000; includeSubDomains`. One line.
- [x] **Same-origin check on mutating API routes** (POST/PUT/PATCH/DELETE): reject when the
      `Origin` header doesn't match the app URL. Skip the Stripe webhook and extension routes.
      Small shared helper, this is the CSRF protection.

## Next: important, a bit more work

- [x] **Audit rate limiting.** Done by `4a2d93d` (2026-09-21): atomic sliding-window limiter
      (Postgres advisory-lock function, optional Redis primary), per-user + global concurrency
      caps on heavy routes, limits added to `generate-pdf`/`generate-docx` and the other previously
      uncovered routes, AI circuit breaker enforced on the request path, self-purging window/lease
      tables. See `docs/rate-limiting-report.md` for the pre-fix audit — it now describes the state
      *before* this commit, not the current one.
      Left over, not urgent: the old `rate_limit_hits` table is still in the schema for rollback
      safety; drop it in a later migration once `4a2d93d` has been live for a while.

## Later

- [x] **Full script-src CSP.** Added: `'self' 'unsafe-inline' https://challenges.cloudflare.com`
      (plus `'unsafe-eval'` in dev only, for webpack's eval-based devtool). Audited by reading the
      code rather than guessing: Turnstile is the only remote script actually loaded; Stripe
      checkout is server-side/redirect-only (no `js.stripe.com`); Supabase is bundled via npm;
      `lib/analytics.ts` calls `window.dataLayer`/`window.plausible` only if something else
      defines them, and nothing does yet. `default-src`/`connect-src`/etc. deliberately left
      unset so nothing else gets silently restricted. Verified with a puppeteer run against both
      `next dev` and `next build && next start` on `/`, `/login`, `/signup`, `/resume-score` — zero
      CSP console violations either way.
      Not done: this uses `'unsafe-inline'`, which still allows inline `<script>` injected by a
      real XSS bug to run. A nonce-based CSP would close that but needs middleware changes to
      mint and thread a per-request nonce — a separate, larger change.
- [x] **Explicit cookie flags** (`secure`, `sameSite`) in `lib/supabase/*`. `@supabase/ssr`'s
      defaults set `sameSite: "lax"` but never set `secure` at all, so this was a real gap
      (cookies had no Secure attribute), not just hardening as first assumed.

## Completed this session (2026-09-28)

- [x] Set `secure: true, sameSite: "lax"` explicitly, via a single shared
      `lib/supabase/cookieOptions.ts` imported by `client.ts`, `server.ts`, and `middleware.ts`
      (`lax`, not `strict`, so the Google OAuth redirect back from the provider doesn't drop the
      session cookie; `secure` closes a real gap since `@supabase/ssr`'s own defaults never set it).
- [x] Confirmed the atomic rate limiter, heavy-route concurrency caps, and `generate-pdf`/
      `generate-docx` rate limits from `4a2d93d` are live on `main` and cover the gaps this file
      previously listed as open.
