-- Match-cache freshness lives on the profile, so a user whose filters match nothing still has a
-- "computed at" marker (otherwise every request recomputed), and the cache swap refuses to write
-- matches computed from a profile version that has since been replaced (a request that read the
-- old profile could otherwise overwrite a concurrent save's fresh matches).

alter table public.job_profiles add column if not exists matches_computed_at timestamptz;

-- Only profile edits bump updated_at; stamping matches_computed_at must not.
drop trigger if exists job_profiles_touch on public.job_profiles;
create trigger job_profiles_touch
  before insert or update of target_titles, skills, locations, remote_ok, min_salary, contract_types,
    seniority, resume_text, profile_text, embedding
  on public.job_profiles
  for each row execute function public.job_profiles_touch();

drop function if exists public.job_matches_replace(uuid, jsonb);

-- Returns false (and writes nothing) when p_profile_updated_at no longer matches the stored
-- profile. The UPDATE's row lock waits out a concurrent profile save and then re-checks.
-- p_profile_updated_at null skips the check (no stored profile to compare against).
create or replace function public.job_matches_replace(
  p_user_id uuid,
  p_rows jsonb,
  p_profile_updated_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.job_profiles
     set matches_computed_at = now()
   where user_id = p_user_id
     and (p_profile_updated_at is null or updated_at = p_profile_updated_at);
  if not found and p_profile_updated_at is not null then
    return false;
  end if;

  delete from public.job_matches where user_id = p_user_id;
  insert into public.job_matches (user_id, job_id, score, reasons)
  select p_user_id, r.job_id, r.score, r.reasons
    from jsonb_to_recordset(p_rows) as r (job_id uuid, score real, reasons jsonb);
  return true;
end;
$$;

revoke all on function public.job_matches_replace(uuid, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.job_matches_replace(uuid, jsonb, timestamptz) to service_role;
