-- Shared, cross-user cache for role-duties suggestions. Unlike role_duty_suggestions/items
-- (per-user, RLS-owned via user_id), this table holds only the AI's generated output - no
-- personal state (confirm/reject/edit/outcome) ever lives here. Populated once per
-- (normalized_job_title, model, prompt_version); read by everyone, written only by the
-- server (service role) via app/api/role-duties/route.ts.
create table if not exists public.role_duty_cache (
  id uuid primary key default gen_random_uuid(),
  -- Keyed on the same normalize() used by the existing per-user reuse lookup (lib/resume/
  -- factCheck.ts) - lowercase, collapse whitespace, trim. Deliberately not a stricter
  -- normalizer: "Sr. Software Engineer" / "Senior Software Engineer" / "Software Engineer II"
  -- do NOT collapse to one row today. Reusing the identical function makes the global hit
  -- behaviour a strict superset of the per-user behaviour it replaces, so there's nothing new
  -- to verify about title matching. A stricter normalizer (abbreviation table) is a possible
  -- follow-up, but only after empirically checking duty-content equivalence across title
  -- phrasings the same way the industry-flavour question was checked before this table shipped.
  normalized_job_title text not null,
  model text not null,
  -- Bump ROLE_DUTIES_PROMPT_VERSION in lib/anthropic/roleDuties.ts on any material SYSTEM_PROMPT
  -- change. A stale row under an old version just goes cold - never deleted, never rewritten.
  prompt_version integer not null,
  duties jsonb not null, -- RawRoleDuty[]: [{ duty_text, category }, ...]
  created_at timestamptz not null default now()
);

-- First-writer-wins: two concurrent misses for the same (title, model, prompt_version) both
-- call the model (both results are equally valid under the same version), but only one row
-- survives - the second insert silently no-ops instead of erroring or overwriting.
create unique index if not exists role_duty_cache_key_idx
  on public.role_duty_cache (normalized_job_title, model, prompt_version);

alter table public.role_duty_cache enable row level security;

-- Idempotent on rerun (plain `create policy` elsewhere in this project errors on a second run -
-- see schema.sql) - drop-then-create so this migration is safe to apply more than once.
drop policy if exists "Any authenticated user can read role duty cache" on public.role_duty_cache;
create policy "Any authenticated user can read role duty cache" on public.role_duty_cache
  for select to authenticated using (true);

-- Deliberately no insert/update/delete policy for `authenticated` - writes only via the
-- service-role client (see lib/anthropic/costLog.ts for the same pattern), which bypasses RLS.
-- A too-permissive write policy here would let any user poison a globally-shared row.
