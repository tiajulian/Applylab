-- One page of a user's cached matches for GET /api/job-matches: joins the job, drops jobs that
-- have since expired or been dismissed, applies the page's filter bar and returns the total
-- (after filters) on every row so the API needs a single round trip.
create or replace function public.job_matches_page(
  p_user_id uuid,
  p_limit integer,
  p_offset integer,
  p_sort text default 'score',
  p_location text default null,
  p_min_salary integer default null,
  p_contract_types text[] default '{}',
  p_max_age_days integer default null
)
returns table (
  job_id uuid,
  score real,
  reasons jsonb,
  saved boolean,
  title text,
  company text,
  location_display text,
  salary_min integer,
  salary_max integer,
  salary_is_predicted boolean,
  contract_type text,
  contract_time text,
  description_snippet text,
  posted_at timestamptz,
  redirect_url text,
  source text,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select m.job_id, m.score, m.reasons,
         exists (select 1 from public.job_interactions s
                  where s.user_id = p_user_id and s.job_id = m.job_id and s.action = 'saved'),
         j.title, j.company, j.location_display, j.salary_min, j.salary_max, j.salary_is_predicted,
         j.contract_type, j.contract_time, j.description_snippet, j.posted_at, j.redirect_url, j.source,
         count(*) over ()
    from public.job_matches m
    join public.adzuna_jobs j on j.id = m.job_id
   where m.user_id = p_user_id
     and j.is_active
     and not exists (select 1 from public.job_interactions d
                      where d.user_id = p_user_id and d.job_id = m.job_id and d.action = 'dismissed')
     and (p_location is null
          or position(lower(p_location) in lower(j.location_display)) > 0
          or lower(p_location) = any (select lower(a) from unnest(j.location_area) a))
     and (p_min_salary is null or j.salary_max is null or j.salary_is_predicted or j.salary_max >= p_min_salary)
     and (not (p_contract_types && array['full_time', 'part_time'])
          or j.contract_time is null or j.contract_time = any (p_contract_types))
     and (not (p_contract_types && array['permanent', 'contract'])
          or j.contract_type is null or j.contract_type = any (p_contract_types))
     and (p_max_age_days is null or j.posted_at >= now() - make_interval(days => p_max_age_days))
   order by case when p_sort = 'newest' then j.posted_at end desc nulls last,
            m.score desc,
            m.job_id
   limit p_limit offset p_offset;
$$;

-- updated_at comes from the database clock, the same clock as job_matches.computed_at, so the
-- "matches computed after the last profile save" freshness check can't be skewed by server time.
create or replace function public.job_profiles_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists job_profiles_touch on public.job_profiles;
create trigger job_profiles_touch before insert or update on public.job_profiles
  for each row execute function public.job_profiles_touch();

create index if not exists job_interactions_user_action_idx on public.job_interactions (user_id, action, created_at desc);

revoke all on function public.job_matches_page(uuid, integer, integer, text, text, integer, text[], integer) from public, anon, authenticated;
grant execute on function public.job_matches_page(uuid, integer, integer, text, text, integer, text[], integer) to service_role;
