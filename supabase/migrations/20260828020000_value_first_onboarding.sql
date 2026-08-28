-- ============================================================================================
-- Value-First Onboarding Migration
-- 1. Make public.users.email nullable for anonymous sessions created before commitment.
-- 2. Add target_role and job_hunt_pain to public.user_profiles for onboarding Q2 and Q3.
-- 3. Add on_auth_user_updated trigger to sync converted email/name from auth.users to public.users.
-- 4. Gate generation-tier and permanent-only tables with is_anonymous check in RLS.
-- ============================================================================================

-- 1. Allow anonymous users with no email yet in public.users
alter table public.users alter column email drop not null;

-- 2. New onboarding question fields on user_profiles
alter table public.user_profiles add column if not exists target_role text;
alter table public.user_profiles add column if not exists job_hunt_pain text;

-- 3. Sync email and full_name when an anonymous auth.users row converts to permanent
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

-- 4. RLS policies: Gate expensive & commitment-level writes to permanent (non-anonymous) accounts only

-- RESUMES: Anonymous can read if created, but cannot insert/update/delete resumes
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

-- RESUME VERSIONS
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

-- APPLICATIONS
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

-- INTERVIEWS
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

-- APPLICATION INTERVIEWS & FOLLOWUPS
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

-- ROLE DUTIES: Permanent accounts only
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
