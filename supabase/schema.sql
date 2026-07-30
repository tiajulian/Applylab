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
