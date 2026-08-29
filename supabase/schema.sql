-- applylab database schema, run once in the Supabase SQL editor.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'lifetime')),
  stripe_customer_id text,
  resumes_used int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  work_rights text,
  phone text,
  location text,
  linkedin_url text,
  work_experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  referees jsonb not null default '[]'::jsonb,
  raw_linkedin_paste text,
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_description text not null,
  job_title text,
  company_name text,
  resume_content jsonb,
  cover_letter_content text,
  ats_score int,
  missing_keywords text[] not null default '{}',
  pdf_url text,
  template text not null default 'ats-safe' check (template in ('ats-safe', 'design-forward')),
  created_at timestamptz not null default now()
);

create index if not exists resumes_user_id_idx on public.resumes (user_id);

-- Keep public.users in sync with auth.users on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: every table is scoped to the owning user.
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.resumes enable row level security;

create policy "Users can view own row" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own row" on public.users
  for update using (auth.uid() = id);

create policy "Users can view own profile" on public.user_profiles
  for select using (auth.uid() = user_id);

create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = user_id);

create policy "Users can view own resumes" on public.resumes
  for select using (auth.uid() = user_id);

create policy "Users can insert own resumes" on public.resumes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own resumes" on public.resumes
  for update using (auth.uid() = user_id);

create policy "Users can delete own resumes" on public.resumes
  for delete using (auth.uid() = user_id);

-- Storage bucket for generated resume PDFs.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

create policy "Users can read own resume PDFs" on storage.objects
  for select using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own resume PDFs" on storage.objects
  for insert with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own resume PDFs" on storage.objects
  for update using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Onboarding + profile-completeness gating.
alter table public.users add column if not exists onboarded boolean not null default false;
alter table public.users add column if not exists profile_completeness int not null default 0;

-- Per-resume AI-assist usage cap (free tier).
alter table public.resumes add column if not exists assist_calls_used int not null default 0;

-- Atomic, race-free usage counters. SECURITY INVOKER (the default) so these run as the
-- calling role — existing RLS policies on resumes/users still apply, ownership enforcement
-- is unchanged. Each increment function returns whether a row was actually updated, so the
-- caller can atomically check-and-increment in one round trip instead of read-compare-write.
create or replace function public.increment_assist_calls(p_resume_id uuid, p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.resumes
  set assist_calls_used = assist_calls_used + 1
  where id = p_resume_id
    and (p_limit is null or assist_calls_used < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.decrement_assist_calls(p_resume_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.resumes
  set assist_calls_used = greatest(assist_calls_used - 1, 0)
  where id = p_resume_id;
end;
$$;

create or replace function public.increment_resumes_used(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.users
  set resumes_used = resumes_used + 1
  where id = p_user_id
    and (p_limit is null or resumes_used < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.decrement_resumes_used(p_user_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.users
  set resumes_used = greatest(resumes_used - 1, 0)
  where id = p_user_id;
end;
$$;

grant execute on function public.increment_assist_calls(uuid, int) to authenticated;
grant execute on function public.decrement_assist_calls(uuid) to authenticated;
grant execute on function public.increment_resumes_used(uuid, int) to authenticated;
grant execute on function public.decrement_resumes_used(uuid) to authenticated;

-- Resume content/quality score (separate from the job-specific ATS score above).
alter table public.resumes add column if not exists content_score int;
alter table public.resumes add column if not exists content_score_breakdown jsonb;
alter table public.resumes add column if not exists content_score_issues jsonb not null default '[]';
alter table public.resumes add column if not exists content_score_count int not null default 0;

create or replace function public.increment_content_score_count(p_resume_id uuid, p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.resumes
  set content_score_count = content_score_count + 1
  where id = p_resume_id
    and (p_limit is null or content_score_count < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.decrement_content_score_count(p_resume_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.resumes
  set content_score_count = greatest(content_score_count - 1, 0)
  where id = p_resume_id;
end;
$$;

grant execute on function public.increment_content_score_count(uuid, int) to authenticated;
grant execute on function public.decrement_content_score_count(uuid) to authenticated;

-- Resume version history (snapshots of resume_content over time).
create table if not exists public.resume_versions (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references public.resumes (id) on delete cascade,
  snapshot jsonb not null,
  label text,
  created_at timestamptz not null default now()
);

create index if not exists resume_versions_resume_id_idx on public.resume_versions (resume_id);

alter table public.resume_versions enable row level security;

-- No user_id column on this table — ownership is enforced via the resumes join, same
-- pattern as the storage-bucket policies above. Snapshots are immutable (no update policy).
create policy "Users can view own resume versions" on public.resume_versions
  for select using (
    exists (select 1 from public.resumes where resumes.id = resume_versions.resume_id and resumes.user_id = auth.uid())
  );

create policy "Users can insert own resume versions" on public.resume_versions
  for insert with check (
    exists (select 1 from public.resumes where resumes.id = resume_versions.resume_id and resumes.user_id = auth.uid())
  );

create policy "Users can delete own resume versions" on public.resume_versions
  for delete using (
    exists (select 1 from public.resumes where resumes.id = resume_versions.resume_id and resumes.user_id = auth.uid())
  );

-- Application tracker: which jobs the user has actually applied to (separate from the
-- resume/cover-letter artifacts above), with an optional link back to the resume used.
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  company_name text not null,
  job_title text not null,
  status text not null default 'applied' check (status in ('applied', 'interviewing', 'offer', 'rejected')),
  applied_date date not null default current_date,
  job_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists applications_user_id_idx on public.applications (user_id);

alter table public.applications enable row level security;

create policy "Users can view own applications" on public.applications
  for select using (auth.uid() = user_id);

create policy "Users can insert own applications" on public.applications
  for insert with check (auth.uid() = user_id);

create policy "Users can update own applications" on public.applications
  for update using (auth.uid() = user_id);

create policy "Users can delete own applications" on public.applications
  for delete using (auth.uid() = user_id);

-- Fingerprints of the inputs each score was computed against, so a re-score request can
-- skip the Claude call (and cost) when nothing has changed since the last score — paid users
-- have no cap on re-scoring, so this is the only thing preventing a wasted call on a stale click.
alter table public.resumes add column if not exists ats_score_content_hash text;
alter table public.resumes add column if not exists content_score_content_hash text;

-- Deterministic hallucination-guardrail flags (see lib/resume/factCheck.ts), computed once at
-- generation/retailor time and surfaced in the review-before-export gate. Server-computed only
-- (see the column-privilege lockdown below) — a user can view but not overwrite their own flags.
alter table public.resumes add column if not exists fact_check_flags jsonb not null default '[]';

-- ============================================================================================
-- Column-level write lockdown for public.users / public.resumes
--
-- The RLS policies above ("Users can update own row" / "Users can update own resumes") only
-- restrict WHICH ROW an authenticated user can update (auth.uid() = id/user_id) — RLS has no
-- concept of per-column restriction. Supabase's default grants give the `authenticated` role
-- UPDATE on every column of every public table, so without this section any signed-in user
-- could call the Supabase REST API directly (their own valid JWT, no app code involved) and:
--   - PATCH their own users.plan to 'pro'/'lifetime', bypassing Stripe entirely;
--   - PATCH users.is_admin to true, self-granting admin;
--   - PATCH users.resumes_used / resumes.assist_calls_used / resumes.content_score_count back
--     to 0, bypassing the free-tier caps enforced by the increment_* RPCs below;
--   - PATCH resumes.ats_score / content_score / content_score_breakdown / content_score_issues
--     / fact_check_flags to fabricate a passing score or suppress guardrail flags.
-- None of this requires finding a bug in the app's own routes — RLS row-scoping alone doesn't
-- prevent it. Column-level GRANT/REVOKE is the correct enforcement layer underneath RLS.
-- ============================================================================================

revoke update on public.users from authenticated;
grant update (full_name, onboarded, profile_completeness) on public.users to authenticated;

revoke update on public.resumes from authenticated;
-- job_title is included alongside the content fields so a user can rename their own resume from
-- the dashboard (see app/api/resume/[id]/route.ts PATCH) without needing service-role access.
grant update (resume_content, template, cover_letter_content, job_title, font_size_pt) on public.resumes to authenticated;

-- The increment/decrement RPCs below need write access to the columns just locked down
-- (resumes_used, assist_calls_used, content_score_count) even though `authenticated` no longer
-- has a direct column grant for them. Redefining them SECURITY DEFINER lets them bypass grants
-- (running with the function owner's privileges) while each function independently re-verifies
-- that the target row belongs to the calling user (auth.uid()) before touching it — the same
-- ownership check RLS used to provide, now enforced inside the function since RLS/grants no
-- longer apply to a SECURITY DEFINER body.
create or replace function public.increment_resumes_used(p_user_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.users
  set resumes_used = resumes_used + 1
  where id = p_user_id
    and id = auth.uid()
    and (p_limit is null or resumes_used < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.decrement_resumes_used(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set resumes_used = greatest(resumes_used - 1, 0)
  where id = p_user_id
    and id = auth.uid();
end;
$$;

create or replace function public.increment_assist_calls(p_resume_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.resumes
  set assist_calls_used = assist_calls_used + 1
  where id = p_resume_id
    and user_id = auth.uid()
    and (p_limit is null or assist_calls_used < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.decrement_assist_calls(p_resume_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resumes
  set assist_calls_used = greatest(assist_calls_used - 1, 0)
  where id = p_resume_id
    and user_id = auth.uid();
end;
$$;

create or replace function public.increment_content_score_count(p_resume_id uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.resumes
  set content_score_count = content_score_count + 1
  where id = p_resume_id
    and user_id = auth.uid()
    and (p_limit is null or content_score_count < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.decrement_content_score_count(p_resume_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resumes
  set content_score_count = greatest(content_score_count - 1, 0)
  where id = p_resume_id
    and user_id = auth.uid();
end;
$$;

-- Admin flag. Deliberately excluded from the authenticated column grant above (users only got
-- full_name/onboarded/profile_completeness) — is_admin is set by hand in the SQL editor for
-- now, and every admin route independently re-checks it via a service-role lookup rather than
-- trusting anything the client sends. See app/api/admin/*.
alter table public.users add column if not exists is_admin boolean not null default false;

-- Per-call Claude API cost log (see lib/anthropic/costLog.ts). Written only by server code via
-- the service-role client. RLS is enabled with no policies for any role, including the owning
-- user — this is operational/cost data, not something either the resume owner or an ordinary
-- authenticated user should be able to read or write; only the admin route (service-role) can.
create table if not exists public.api_cost_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  feature text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now()
);

-- Prompt-cache usage from the response `usage` block — how we confirm cache hits are actually
-- happening and measure the savings, alongside the existing token counts above.
alter table public.api_cost_log add column if not exists cache_creation_input_tokens int not null default 0;
alter table public.api_cost_log add column if not exists cache_read_input_tokens int not null default 0;

-- Which AI provider served this call (anthropic/openai/gemini) — see lib/anthropic/models.ts.
-- Existing rows predate multi-provider support and are all genuinely Anthropic calls, so
-- defaulting to 'anthropic' backfills them correctly with no manual data fix needed.
alter table public.api_cost_log add column if not exists provider text not null default 'anthropic';

create index if not exists api_cost_log_user_id_idx on public.api_cost_log (user_id);
create index if not exists api_cost_log_created_at_idx on public.api_cost_log (created_at);

alter table public.api_cost_log enable row level security;

-- ============================================================================================
-- Skills Bridge: maps a candidate's real, confirmed experience to a target role's requirements
-- before generation, so only user-confirmed claims ever reach the resume. See
-- lib/anthropic/skillsBridge.ts (analysis), app/api/skills-bridge/* (routes), and
-- lib/resume/factCheck.ts (honesty backstop).
-- ============================================================================================

create table if not exists public.skills_bridges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_title text not null,
  company_name text not null,
  -- sha256 of the job description text (see lib/resume/scoreCache.ts#hashForScoring), not the
  -- full text itself — this is purely a reuse/change-detection key, not something read back.
  job_description_hash text not null,
  mode text not null check (mode in ('pivot', 'level_up')),
  created_at timestamptz not null default now()
);

create index if not exists skills_bridges_user_id_idx on public.skills_bridges (user_id);
-- Backs the reuse lookup in POST /api/skills-bridge: same user + same target (title, company,
-- and job description content) reuses the existing analysis instead of re-calling Claude.
create index if not exists skills_bridges_reuse_idx
  on public.skills_bridges (user_id, job_title, company_name, job_description_hash);

create table if not exists public.skills_bridge_items (
  id uuid primary key default gen_random_uuid(),
  bridge_id uuid not null references public.skills_bridges (id) on delete cascade,
  -- Empty strings (not null) for `gap` items, which by design carry no source to point to.
  source_company text not null default '',
  source_job_title text not null default '',
  source_snippet text not null default '',
  competency text not null default '',
  target_requirement text not null default '',
  state text not null check (state in ('matched', 'to_confirm', 'gap')),
  confidence text not null default 'medium' check (confidence in ('low', 'medium', 'high')),
  user_state text not null default 'pending' check (user_state in ('pending', 'confirmed', 'rejected')),
  user_note text
);

create index if not exists skills_bridge_items_bridge_id_idx on public.skills_bridge_items (bridge_id);

alter table public.skills_bridges enable row level security;
alter table public.skills_bridge_items enable row level security;

create policy "Users can view own skills bridges" on public.skills_bridges
  for select using (auth.uid() = user_id);

create policy "Users can insert own skills bridges" on public.skills_bridges
  for insert with check (auth.uid() = user_id);

-- No user_id column on this table — ownership is enforced via the skills_bridges join, same
-- pattern as resume_versions above.
create policy "Users can view own skills bridge items" on public.skills_bridge_items
  for select using (
    exists (select 1 from public.skills_bridges where skills_bridges.id = skills_bridge_items.bridge_id and skills_bridges.user_id = auth.uid())
  );

create policy "Users can insert own skills bridge items" on public.skills_bridge_items
  for insert with check (
    exists (select 1 from public.skills_bridges where skills_bridges.id = skills_bridge_items.bridge_id and skills_bridges.user_id = auth.uid())
  );

create policy "Users can update own skills bridge items" on public.skills_bridge_items
  for update using (
    exists (select 1 from public.skills_bridges where skills_bridges.id = skills_bridge_items.bridge_id and skills_bridges.user_id = auth.uid())
  );

-- Column-level lockdown, same reasoning as the public.resumes section above: state, competency,
-- target_requirement, source_*, and confidence are Claude's analysis output, not something a
-- user should be able to PATCH directly via the Supabase REST API (e.g. turning a `gap` straight
-- into a `matched`, or rewriting the evidence text). Only the user's own confirm/reject/note
-- fields are theirs to write.
revoke update on public.skills_bridge_items from authenticated;
grant update (user_state, user_note) on public.skills_bridge_items to authenticated;

-- Bridge honesty-backstop flags (see lib/resume/factCheck.ts#flagUnconfirmedBridgeClaims),
-- stored separately from fact_check_flags since it's a different check against a different
-- source of truth (the confirmed bridge, not the raw profile). Server-computed only, so it's
-- deliberately not included in the resumes column grant below.
alter table public.resumes add column if not exists bridge_fact_check_flags jsonb not null default '[]';

-- Which bridge (if any) this resume was generated from. Set once at generation time in
-- app/api/generate-resume/route.ts; nulled automatically if the bridge is later deleted.
alter table public.resumes add column if not exists skills_bridge_id uuid references public.skills_bridges (id) on delete set null;

-- ============================================================================================
-- Role duty suggestions: helps a thin (empty/short) work_experience entry by suggesting what
-- that JOB TITLE normally involves (never derived from a target job description - see
-- lib/anthropic/roleDuties.ts), then only using duties the candidate explicitly ticks. Confirmed
-- duties become trusted evidence, same treatment as skills_bridge_items.user_note above. See
-- lib/anthropic/roleDuties.ts (suggestion), app/api/role-duties/* (routes), and
-- lib/resume/factCheck.ts (honesty backstop).
-- ============================================================================================

create table if not exists public.role_duty_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  -- Normalized (trimmed, lowercased) job title - the reuse key. Role-based suggestions don't
  -- depend on company or any target job, so title alone is enough to safely reuse a result.
  job_title text not null,
  created_at timestamptz not null default now()
);

create index if not exists role_duty_suggestions_user_id_idx on public.role_duty_suggestions (user_id);
-- Backs the reuse lookup in POST /api/role-duties: same user + same job title reuses the
-- existing suggestion set instead of re-calling Claude.
create index if not exists role_duty_suggestions_reuse_idx
  on public.role_duty_suggestions (user_id, job_title);

create table if not exists public.role_duty_items (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.role_duty_suggestions (id) on delete cascade,
  duty_text text not null default '',
  user_state text not null default 'pending' check (user_state in ('pending', 'confirmed', 'rejected'))
);

create index if not exists role_duty_items_suggestion_id_idx on public.role_duty_items (suggestion_id);

alter table public.role_duty_suggestions enable row level security;
alter table public.role_duty_items enable row level security;

create policy "Users can view own role duty suggestions" on public.role_duty_suggestions
  for select using (auth.uid() = user_id);

create policy "Users can insert own role duty suggestions" on public.role_duty_suggestions
  for insert with check (auth.uid() = user_id);

-- No user_id column on this table - ownership is enforced via the role_duty_suggestions join,
-- same pattern as skills_bridge_items above.
create policy "Users can view own role duty items" on public.role_duty_items
  for select using (
    exists (select 1 from public.role_duty_suggestions where role_duty_suggestions.id = role_duty_items.suggestion_id and role_duty_suggestions.user_id = auth.uid())
  );

create policy "Users can insert own role duty items" on public.role_duty_items
  for insert with check (
    exists (select 1 from public.role_duty_suggestions where role_duty_suggestions.id = role_duty_items.suggestion_id and role_duty_suggestions.user_id = auth.uid())
  );

create policy "Users can update own role duty items" on public.role_duty_items
  for update using (
    exists (select 1 from public.role_duty_suggestions where role_duty_suggestions.id = role_duty_items.suggestion_id and role_duty_suggestions.user_id = auth.uid())
  );

-- Column-level lockdown, same reasoning as skills_bridge_items above: duty_text is Claude's
-- suggestion output, not something a user should be able to PATCH directly. Only the user's own
-- confirm/reject transition is theirs to write.
revoke update on public.role_duty_items from authenticated;
grant update (user_state) on public.role_duty_items to authenticated;

-- Lets a candidate correct a suggested duty in place instead of only accepting or rejecting it
-- verbatim. Generation prefers this over duty_text when set and the item is confirmed (see
-- buildConfirmedRoleDuties in lib/resume/factCheck.ts). Same user-authored-text treatment as
-- skills_bridge_items.user_note above, so it's added to the update grant alongside user_state.
alter table public.role_duty_items add column if not exists user_edited_text text;
grant update (user_state, user_edited_text) on public.role_duty_items to authenticated;

-- Optional per-task impact capture: what a confirmed duty achieved or why it mattered, and an
-- optional real number/metric attached to it, in the candidate's own words. The only source of a
-- task's impact - never inferred or generated (see RESUME_SYSTEM_PROMPT in
-- lib/anthropic/generateResume.ts). Same user-authored-text treatment as user_edited_text above.
alter table public.role_duty_items add column if not exists outcome_text text;
alter table public.role_duty_items add column if not exists outcome_metric text;
grant update (user_state, user_edited_text, outcome_text, outcome_metric) on public.role_duty_items to authenticated;

-- Optional per-task tool/stakeholder picks for a confirmed duty, same slots and same
-- text[]-accumulate-and-reuse pattern as the Win Builder's user_profiles.tools/stakeholders
-- below. Lets a thin duty (see lib/wins/dutyCoverage.ts) be filled through the Win Builder
-- itself rather than a second capture path - see components/profile/RoleDutiesReview.tsx.
alter table public.role_duty_items add column if not exists tools text[] not null default '{}';
alter table public.role_duty_items add column if not exists stakeholders text[] not null default '{}';
grant update (user_state, user_edited_text, outcome_text, outcome_metric, tools, stakeholders) on public.role_duty_items to authenticated;

-- Short grouping label assigned by suggestRoleDuties alongside duty_text (e.g. "Data
-- engineering"), used to drive the category filter tabs in SuggestTasksBuilder.tsx. Same
-- not-user-writable treatment as duty_text - it's Claude's output, not left out of the update
-- grant below.
alter table public.role_duty_items add column if not exists category text;

-- ============================================================================================
-- Terms & Conditions acceptance tracking. TERMS_VERSION (lib/terms.ts) is the single source of
-- truth for the current version string - bump it there whenever the terms change materially.
-- Deliberately not added to the public.users column grant below: a client-writable column would
-- let any signed-in user PATCH an arbitrary accepted_terms_at/version via the REST API without
-- ever having agreed to anything. Instead, acceptance is only ever recorded through:
--   - handle_new_user() below, for email/password signups - the signup form's required
--     checkbox gates whether accepted_terms_version is ever included in the signup metadata,
--     and the timestamp is always server-generated (now()), never trusted from the client.
--   - accept_terms() below, called from the Google OAuth callback (app/auth/callback/route.ts)
--     and the one-time acceptance gate for existing users (app/accept-terms) - SECURITY DEFINER
--     and scoped to auth.uid() so the client can only trigger the call, not choose the values.
-- ============================================================================================

alter table public.users add column if not exists accepted_terms_at timestamptz;
alter table public.users add column if not exists accepted_terms_version text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, accepted_terms_at, accepted_terms_version)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when new.raw_user_meta_data ->> 'accepted_terms_version' is not null then now() else null end,
    new.raw_user_meta_data ->> 'accepted_terms_version'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.accept_terms(p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set accepted_terms_at = now(),
      accepted_terms_version = p_version
  where id = auth.uid();
end;
$$;

grant execute on function public.accept_terms(text) to authenticated;

-- Standalone projects (side/freelance/volunteer/study work not tied to a single employer),
-- profile-level source of truth, same jsonb-array-on-user_profiles pattern as work_experience.
alter table public.user_profiles add column if not exists projects jsonb not null default '[]'::jsonb;

-- Each work_experience jsonb entry carries a `wins` array (each { text, metric }, labelled "Wins"
-- in the UI) instead of a single achievement/achievement_metric pair, so a candidate can log
-- multiple concrete wins per role, each with its own optional metric. No column change needed
-- here (work_experience is unstructured jsonb); existing single-item rows are normalized into a
-- one-item wins list at every read boundary (see lib/profile/normalizeWorkExperience.ts, used by
-- both the profile edit form and the server-side generate-resume route) rather than only on the
-- client, so a role saved before this rework still contributes its wins to generation.

-- Deterministic quality-gate result (lib/resume/qualityGate.ts), computed once after generation
-- and before this row is inserted (see app/api/generate-resume/route.ts). Composes
-- fact_check_flags/bridge_fact_check_flags plus new date-consistency and user-data-coverage
-- checks into one { needsReview, checks[] } result; null for resumes generated before the gate
-- existed.
alter table public.resumes add column if not exists gate_result jsonb;

-- ============================================================================================
-- Compact job ad cache (token optimisation - see lib/resume/parsedJobAdCache.ts and
-- lib/anthropic/parseJobAd.ts). Caches the structured facts extracted from a raw job ad
-- (title, company, seniority, skills, tools, responsibilities, keywords) so the same ad is
-- only ever parsed once, then reused by every cheap consumer (assist, ats-score, cover-letter,
-- retailor) and the New Resume autofill instead of re-parsing or re-sending the raw ad text.
--
-- Keyed purely by a hash of the ad text (public.hashForScoring-equivalent sha256, see
-- lib/resume/scoreCache.ts) and deliberately NOT scoped by user_id - two different candidates
-- pasting the same ad get the same cached facts, since this table only ever holds facts
-- extracted from the ad's own public text, never anything candidate-specific or invented. RLS
-- is enabled with no policies for any role, same lockdown as api_cost_log above: this is
-- write-once derived cache data, not something any authenticated user should read or write
-- directly via the REST API, only the service-role helper that owns it.
-- ============================================================================================

create table if not exists public.parsed_job_ads (
  id uuid primary key default gen_random_uuid(),
  job_description_hash text not null unique,
  title text not null default '',
  company text not null default '',
  seniority text not null default '',
  must_have_skills text[] not null default '{}',
  nice_to_have_skills text[] not null default '{}',
  tools text[] not null default '{}',
  key_responsibilities text[] not null default '{}',
  keywords text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.parsed_job_ads enable row level security;

-- Win Builder (step-through achievement capture) - profile-level reusable tool/stakeholder
-- picks, same jsonb-array-on-user_profiles pattern as `skills` (text[], accumulate-and-reuse).
-- No new table for the win's structured slots (verb/what/tools/stakeholders/outcome) - they live
-- inside the existing work_experience jsonb entries' `wins` array (see types/index.ts), same as
-- `wins` itself needed no column change when it was added.
alter table public.user_profiles add column if not exists tools text[] not null default '{}';
alter table public.user_profiles add column if not exists stakeholders text[] not null default '{}';

-- User-chosen base font size for the final resume editor/export (see lib/resume/templateDensity.ts
-- and components/resume/FontSizeStepper.tsx). Discrete 0.5pt steps only, floor is
-- FONT_FLOOR_PT (9.5) - the same floor the automatic page-fit trim ladder already respects, so a
-- user pick is a starting point the ladder trims *down* from if the resume doesn't fit, never a
-- way to go below the floor the ladder itself enforces. Default matches DEFAULT_DENSITY.fontPt.
alter table public.resumes add column if not exists font_size_pt numeric(3,1) not null default 10
  check (font_size_pt >= 9.5 and font_size_pt <= 12);

-- Onboarding goal picker (components/onboarding/GoalSelectionStep.tsx) - drives which resume
-- framing/tone guidance generateResume.ts applies (see goalDescriptions in
-- lib/anthropic/generateResume.ts). Was read/written by app code (types/index.ts CareerGoal,
-- app/api/profile/route.ts) without ever being added here, which is why PostgREST reports it
-- missing from the schema cache.
alter table public.user_profiles add column if not exists career_goal text
  check (career_goal in (
    'career_transition', 'first_job', 'better_company', 'level_up_senior', 'break_into_tech', 'exploring'
  ));

-- ============================================================================================
-- AI Interview Prep Feature: sessions and turns.
-- Anchored to public.resumes for job context; turns are turn-based Q&A with STAR & delivery scoring.
-- Audio clips are analyzed via Gemini multimodal API and discarded immediately (not persisted).
-- AI-scored columns on sessions and turns are updated only via service role.
-- ============================================================================================

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  stage_type text not null check (stage_type in ('phone_screen', 'technical', 'panel', 'async_video', 'group', 'general')),
  -- 'coaching' (stage_type = 'group' only) skips STAR scoring entirely - a 1:1 voice AI can't
  -- honestly assess multi-party group dynamics. See lib/interview/mode.ts.
  mode text not null default 'simulation' check (mode in ('simulation', 'coaching')),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  overall_score int,
  report jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists interview_sessions_user_id_idx on public.interview_sessions (user_id);
create index if not exists interview_sessions_resume_id_idx on public.interview_sessions (resume_id);

alter table public.interview_sessions enable row level security;

create policy "Users can view own interview sessions" on public.interview_sessions
  for select using (auth.uid() = user_id);

-- Deliberately no client-facing INSERT policy: sessions are only ever created by
-- app/api/interview/sessions/route.ts via the service-role client (it needs to plan and insert
-- the Gemini-generated turns in the same request, which no RLS-scoped client call could do
-- atomically). Without this, RLS falls back to its default-deny for INSERT, which is exactly
-- what's wanted here - a client-side INSERT would otherwise let any signed-in user fabricate a
-- 'completed' session with a fake overall_score/report, since only UPDATE (not INSERT) is
-- column-locked below. See the equivalent note on interview_turns' INSERT policy.

create policy "Users can update own interview sessions" on public.interview_sessions
  for update using (auth.uid() = user_id);

create policy "Users can delete own interview sessions" on public.interview_sessions
  for delete using (auth.uid() = user_id);

revoke update on public.interview_sessions from authenticated;
grant update (status) on public.interview_sessions to authenticated;

create table if not exists public.interview_turns (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  order_index int not null,
  question_type text not null,
  question_text text not null,
  is_followup boolean not null default false,
  parent_turn_id uuid references public.interview_turns (id) on delete set null,
  transcript text,
  answer_source text check (answer_source in ('voice', 'text')),
  duration_sec numeric,
  wpm numeric,
  filler_count int,
  star_scores jsonb,
  content_feedback text,
  delivery_feedback text,
  suggested_answer text,
  created_at timestamptz not null default now()
);

create index if not exists interview_turns_session_id_idx on public.interview_turns (session_id);

alter table public.interview_turns enable row level security;

create policy "Users can view own interview turns" on public.interview_turns
  for select using (
    exists (
      select 1 from public.interview_sessions
      where interview_sessions.id = interview_turns.session_id
        and interview_sessions.user_id = auth.uid()
    )
  );

-- Deliberately no client-facing INSERT policy: turns are only ever created by the service-role
-- client in app/api/interview/sessions/route.ts (initial plan) and
-- app/api/interview/sessions/[id]/turns/route.ts (adaptive follow-ups). Falling back to RLS's
-- default-deny for INSERT prevents a signed-in user from POSTing a fabricated, already-scored
-- turn (star_scores/content_feedback/suggested_answer) directly via the REST API.

create policy "Users can update own interview turns" on public.interview_turns
  for update using (
    exists (
      select 1 from public.interview_sessions
      where interview_sessions.id = interview_turns.session_id
        and interview_sessions.user_id = auth.uid()
    )
  );

revoke update on public.interview_turns from authenticated;

-- ============================================================================================
-- Scheduled interview rounds for an application (Spec 01)
-- Multi-round tracking with stage, timestamps, deadlines, location, and outcomes.
-- ============================================================================================

create table if not exists public.application_interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  stage_type text not null check (stage_type in ('phone_screen', 'technical', 'panel', 'async_video', 'group', 'general')),
  scheduled_at timestamptz not null,
  is_deadline boolean not null default false,
  location text,
  notes text,
  outcome text not null default 'scheduled' check (outcome in ('scheduled', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists application_interviews_application_id_idx
  on public.application_interviews (application_id);
create index if not exists application_interviews_upcoming_idx
  on public.application_interviews (scheduled_at)
  where outcome = 'scheduled';

alter table public.application_interviews enable row level security;

create policy "Users can view own application interviews" on public.application_interviews
  for select using (
    exists (select 1 from public.applications where applications.id = application_interviews.application_id and applications.user_id = auth.uid())
  );

create policy "Users can insert own application interviews" on public.application_interviews
  for insert with check (
    exists (select 1 from public.applications where applications.id = application_interviews.application_id and applications.user_id = auth.uid())
  );

create policy "Users can update own application interviews" on public.application_interviews
  for update using (
    exists (select 1 from public.applications where applications.id = application_interviews.application_id and applications.user_id = auth.uid())
  );

create policy "Users can delete own application interviews" on public.application_interviews
  for delete using (
    exists (select 1 from public.applications where applications.id = application_interviews.application_id and applications.user_id = auth.uid())
  );

-- ============================================================================================
-- Ad close dates on parsed job ads (Spec 04)
-- ============================================================================================

alter table public.parsed_job_ads add column if not exists closes_at date;
alter table public.parsed_job_ads add column if not exists closes_at_state text not null default 'unknown'
  check (closes_at_state in ('unknown', 'absolute', 'relative', 'absent'));
alter table public.parsed_job_ads add column if not exists closes_at_source text;

-- ============================================================================================
-- Generated follow-up drafts for applications (Spec 05)
-- ============================================================================================

create table if not exists public.application_followups (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  draft_text text not null,
  model text not null,
  copied_at timestamptz,
  edited_text text,
  created_at timestamptz not null default now()
);

create index if not exists application_followups_application_id_idx
  on public.application_followups (application_id);
create index if not exists application_followups_user_id_idx
  on public.application_followups (user_id);

alter table public.application_followups enable row level security;

create policy "Users can view own followups" on public.application_followups
  for select using (
    exists (select 1 from public.applications where applications.id = application_followups.application_id and applications.user_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "Users can insert own followups" on public.application_followups
  for insert with check (
    exists (select 1 from public.applications where applications.id = application_followups.application_id and applications.user_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "Users can update own followups" on public.application_followups
  for update using (
    exists (select 1 from public.applications where applications.id = application_followups.application_id and applications.user_id = auth.uid())
    or user_id = auth.uid()
  );

create policy "Users can delete own followups" on public.application_followups
  for delete using (
    exists (select 1 from public.applications where applications.id = application_followups.application_id and applications.user_id = auth.uid())
  );

revoke update on public.application_followups from authenticated;
grant update (edited_text, copied_at) on public.application_followups to authenticated;

-- ============================================================================================
-- Applied via supabase/migrations/20260828014600_role_duty_cache.sql - see that file for the
-- full reasoning comments (cache key design, concurrency, invalidation, RLS rationale).
-- ============================================================================================

create table if not exists public.role_duty_cache (
  id uuid primary key default gen_random_uuid(),
  normalized_job_title text not null,
  model text not null,
  prompt_version integer not null,
  duties jsonb not null, -- RawRoleDuty[]: [{ duty_text, category }, ...]
  created_at timestamptz not null default now()
);

create unique index if not exists role_duty_cache_key_idx
  on public.role_duty_cache (normalized_job_title, model, prompt_version);

alter table public.role_duty_cache enable row level security;

drop policy if exists "Any authenticated user can read role duty cache" on public.role_duty_cache;
create policy "Any authenticated user can read role duty cache" on public.role_duty_cache
  for select to authenticated using (true);

-- Deliberately no insert/update/delete policy for `authenticated` - writes only via the
-- service-role client (see lib/anthropic/costLog.ts for the same pattern), which bypasses RLS.

-- ============================================================================================
-- Applied via supabase/migrations/20260828020000_value_first_onboarding.sql - see that file for
-- the full reasoning comments (anonymous auth support, Q2/Q3 fields, user sync trigger, RLS).
-- ============================================================================================

alter table public.users alter column email drop not null;

alter table public.user_profiles add column if not exists target_role text;
alter table public.user_profiles add column if not exists job_hunt_pain text;

create or replace function public.handle_user_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
  set email = coalesce(new.email, email),
      full_name = coalesce(new.raw_user_meta_data ->> 'full_name', full_name)
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
  after update of email, raw_user_meta_data on auth.users
  for each row execute function public.handle_user_update();

-- Gated RLS policies for non-anonymous accounts on generation/permanent tables
drop policy if exists "Users can insert own resumes" on public.resumes;
create policy "Users can insert own resumes" on public.resumes
  for insert with check (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own resumes" on public.resumes;
create policy "Users can update own resumes" on public.resumes
  for update using (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can delete own resumes" on public.resumes;
create policy "Users can delete own resumes" on public.resumes
  for delete using (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own resume versions" on public.resume_versions;
create policy "Users can insert own resume versions" on public.resume_versions
  for insert with check (
    auth.uid() = (select user_id from public.resumes where id = resume_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can delete own resume versions" on public.resume_versions;
create policy "Users can delete own resume versions" on public.resume_versions
  for delete using (
    auth.uid() = (select user_id from public.resumes where id = resume_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own applications" on public.applications;
create policy "Users can insert own applications" on public.applications
  for insert with check (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own applications" on public.applications;
create policy "Users can update own applications" on public.applications
  for update using (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can delete own applications" on public.applications;
create policy "Users can delete own applications" on public.applications
  for delete using (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own interview sessions" on public.interview_sessions;
create policy "Users can insert own interview sessions" on public.interview_sessions
  for insert with check (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own interview sessions" on public.interview_sessions;
create policy "Users can update own interview sessions" on public.interview_sessions
  for update using (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can delete own interview sessions" on public.interview_sessions;
create policy "Users can delete own interview sessions" on public.interview_sessions
  for delete using (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own interview turns" on public.interview_turns;
create policy "Users can insert own interview turns" on public.interview_turns
  for insert with check (
    auth.uid() = (select user_id from public.interview_sessions where id = session_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own interview turns" on public.interview_turns;
create policy "Users can update own interview turns" on public.interview_turns
  for update using (
    auth.uid() = (select user_id from public.interview_sessions where id = session_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own application interviews" on public.application_interviews;
create policy "Users can insert own application interviews" on public.application_interviews
  for insert with check (
    auth.uid() = (select user_id from public.applications where id = application_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own application interviews" on public.application_interviews;
create policy "Users can update own application interviews" on public.application_interviews
  for update using (
    auth.uid() = (select user_id from public.applications where id = application_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can delete own application interviews" on public.application_interviews;
create policy "Users can delete own application interviews" on public.application_interviews
  for delete using (
    auth.uid() = (select user_id from public.applications where id = application_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own followups" on public.application_followups;
create policy "Users can insert own followups" on public.application_followups
  for insert with check (
    auth.uid() = (select user_id from public.applications where id = application_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own followups" on public.application_followups;
create policy "Users can update own followups" on public.application_followups
  for update using (
    auth.uid() = (select user_id from public.applications where id = application_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can delete own followups" on public.application_followups;
create policy "Users can delete own followups" on public.application_followups
  for delete using (
    auth.uid() = (select user_id from public.applications where id = application_id) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own role duty suggestions" on public.role_duty_suggestions;
create policy "Users can insert own role duty suggestions" on public.role_duty_suggestions
  for insert with check (
    auth.uid() = user_id and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can insert own role duty items" on public.role_duty_items;
create policy "Users can insert own role duty items" on public.role_duty_items
  for insert with check (
    exists (
      select 1 from public.role_duty_suggestions
      where role_duty_suggestions.id = role_duty_items.suggestion_id
        and role_duty_suggestions.user_id = auth.uid()
    ) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

drop policy if exists "Users can update own role duty items" on public.role_duty_items;
create policy "Users can update own role duty items" on public.role_duty_items
  for update using (
    exists (
      select 1 from public.role_duty_suggestions
      where role_duty_suggestions.id = role_duty_items.suggestion_id
        and role_duty_suggestions.user_id = auth.uid()
    ) and
    (auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  );

-- ============================================================================================
-- Applied via supabase/migrations/20260828021500_rate_limit_hits.sql - see that file for
-- the persistent, cross-instance rate limiting rationale.
-- ============================================================================================

create table if not exists public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_created_idx on public.rate_limit_hits (rate_key, created_at);

alter table public.rate_limit_hits enable row level security;

-- No policies for any role — written only via the service-role client, same lockdown
-- pattern as public.api_cost_log and public.parsed_job_ads in schema.sql.

-- ============================================================================================
-- Applied via supabase/migrations/20260828030000_ai_resume_review.sql - see that file for
-- the 5-category AI Resume Review fields.
-- ============================================================================================
alter table public.resumes add column if not exists review_overall_score int;
alter table public.resumes add column if not exists review_categories jsonb;
alter table public.resumes add column if not exists review_findings jsonb not null default '[]';
alter table public.resumes add column if not exists review_content_hash text;
alter table public.resumes add column if not exists review_scored_at timestamptz;

-- ============================================================================================
-- Applied via supabase/migrations/20260829000000_resume_unlocks.sql - one-time micro-unlocks
-- for individual resumes ($2.99 AUD clean export unlock).
-- ============================================================================================
create table if not exists public.resume_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  stripe_session_id text,
  amount_aud int not null default 299,
  unlocked_at timestamptz not null default now(),
  constraint resume_unlocks_user_resume_unique unique (user_id, resume_id)
);

create index if not exists resume_unlocks_user_id_idx on public.resume_unlocks (user_id);
create index if not exists resume_unlocks_resume_id_idx on public.resume_unlocks (resume_id);

alter table public.resume_unlocks enable row level security;

create policy "Users can view own resume unlocks" on public.resume_unlocks
  for select using (auth.uid() = user_id);





