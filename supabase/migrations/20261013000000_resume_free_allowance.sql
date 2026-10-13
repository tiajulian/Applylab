-- Free users can download the one tailored resume their plan includes (pricing brief, section 6).
-- resumes.is_free_allowance marks that resume; lib/requireUser.ts canExportResume reads it.
--
-- Only the server may set it. Users can insert their own resumes directly (RLS insert policy),
-- so a trigger forces the flag false on any insert made as `authenticated`/`anon`; the generation
-- routes then set it with the service role (markFreeAllowanceResume). It is deliberately not in
-- the authenticated column update grant on public.resumes (supabase/schema.sql), so users can't
-- flip it later either.

alter table public.resumes
  add column if not exists is_free_allowance boolean not null default false;

create or replace function public.resumes_force_free_allowance_off()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_free_allowance := false;
  end if;
  return new;
end;
$$;

drop trigger if exists resumes_force_free_allowance_off on public.resumes;
create trigger resumes_force_free_allowance_off
  before insert on public.resumes
  for each row execute function public.resumes_force_free_allowance_off();

-- A user never has more than one free-allowance resume.
create unique index if not exists resumes_one_free_allowance_per_user
  on public.resumes (user_id)
  where is_free_allowance;
