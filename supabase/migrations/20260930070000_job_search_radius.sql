-- Job Matcher search by distance: a profile location ("Kogarah") becomes map points, and a job
-- matches when it is within the profile's search radius of any of them, so a suburb covers its
-- whole metro area and users can widen (or drop) the range and add places they'd move to.
--
-- au_places: Australian localities with coordinates from GeoNames (CC BY 4.0, credit shown in
-- the Job Matcher UI), loaded by scripts/load-au-places.mjs. One row per name + state.

create table if not exists public.au_places (
  name_key text not null,  -- lower(name), the lookup key
  name text not null,
  state text not null,     -- full state name, as in Adzuna location_area[2]
  state_code text not null,
  lat double precision not null,
  lng double precision not null,
  primary key (name_key, state)
);

alter table public.au_places enable row level security;

alter table public.job_profiles add column if not exists search_radius_km integer default 50
  check (search_radius_km is null or search_radius_km between 1 and 1000);  -- null = anywhere in Australia
alter table public.job_profiles add column if not exists location_points jsonb not null default '[]'::jsonb;

-- Radius and resolved points are part of the matching inputs, so changing them must bump updated_at.
drop trigger if exists job_profiles_touch on public.job_profiles;
create trigger job_profiles_touch
  before insert or update of target_titles, skills, locations, remote_ok, min_salary, contract_types,
    seniority, resume_text, profile_text, embedding, search_radius_km, location_points
  on public.job_profiles
  for each row execute function public.job_profiles_touch();

-- Replaced by the au_places lookup.
drop index if exists public.adzuna_jobs_location_area_idx;

-- Great-circle distance in km.
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
parallel safe
as $$
  select 12742 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

drop function if exists public.adzuna_match_candidates(extensions.vector, text[], boolean, integer, text[], uuid, integer);

-- Stages 1-2 of matching: hard filters, then the nearest jobs by cosine distance. A job's position
-- is its own coordinates, or failing that its most specific Adzuna area name found in au_places.
-- Location passes when: no radius (anywhere) or no locations; within p_radius_km of any profile
-- point; its text names a profile location (states, unresolved places); or remote and remote_ok.
create or replace function public.adzuna_match_candidates(
  p_embedding extensions.vector,
  p_locations text[],
  p_remote_ok boolean,
  p_min_salary integer,
  p_contract_types text[],
  p_user_id uuid,
  p_limit integer default 200,
  p_points jsonb default '[]'::jsonb,
  p_radius_km integer default 50
)
returns table (
  id uuid,
  title text,
  company text,
  description_snippet text,
  location_display text,
  category_label text,
  salary_min integer,
  salary_max integer,
  salary_is_predicted boolean,
  contract_type text,
  contract_time text,
  posted_at timestamptz,
  redirect_url text,
  distance double precision
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform set_config('hnsw.iterative_scan', 'strict_order', true);
  perform set_config('hnsw.ef_search', greatest(p_limit, 40)::text, true);

  return query
  select j.id, j.title, j.company, j.description_snippet, j.location_display, j.category_label,
         j.salary_min, j.salary_max, j.salary_is_predicted, j.contract_type, j.contract_time,
         j.posted_at, j.redirect_url, (j.embedding <=> p_embedding)::double precision
    from public.adzuna_jobs j
   where j.is_active
     and j.embedding is not null
     and (
       p_radius_km is null
       or cardinality(p_locations) = 0
       or exists (
         select 1
           from jsonb_to_recordset(p_points) as pt (lat double precision, lng double precision),
                lateral (
                  select j.lat, j.lng where j.lat is not null and not (j.lat = 0 and j.lng = 0)
                  union all
                  (select ap.lat, ap.lng
                     from unnest(j.location_area) with ordinality as a (name, pos)
                     join public.au_places ap
                       on ap.name_key = lower(a.name)
                      and (cardinality(j.location_area) < 2 or ap.state = j.location_area[2])
                    where j.lat is null or (j.lat = 0 and j.lng = 0)
                    order by a.pos desc
                    limit 1)
                ) as jp (lat, lng)
          where public.km_between(pt.lat, pt.lng, jp.lat, jp.lng) <= p_radius_km
       )
       or exists (
         select 1 from unnest(p_locations) l
          where lower(l) = any (select lower(a) from unnest(j.location_area) a)
             or position(lower(l) in lower(j.location_display)) > 0
       )
       or (p_remote_ok and (j.title || ' ' || j.description_snippet) ~* '\m(remote|work from home|wfh)\M')
     )
     and (p_min_salary is null or j.salary_max is null or j.salary_is_predicted or j.salary_max >= p_min_salary)
     and (not (p_contract_types && array['full_time', 'part_time'])
          or j.contract_time is null or j.contract_time = any (p_contract_types))
     and (not (p_contract_types && array['permanent', 'contract'])
          or j.contract_type is null or j.contract_type = any (p_contract_types))
     and (p_user_id is null or not exists (
       select 1 from public.job_interactions i
        where i.user_id = p_user_id and i.job_id = j.id and i.action = 'dismissed'
     ))
   order by j.embedding <=> p_embedding
   limit p_limit;
end;
$$;

revoke all on function public.adzuna_match_candidates(extensions.vector, text[], boolean, integer, text[], uuid, integer, jsonb, integer) from public, anon, authenticated;
grant execute on function public.adzuna_match_candidates(extensions.vector, text[], boolean, integer, text[], uuid, integer, jsonb, integer) to service_role;
