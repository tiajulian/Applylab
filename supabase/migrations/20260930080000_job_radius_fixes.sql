-- Radius search fixes:
-- * Map points are resolved from locations at match time (lib/jobs/places.ts) instead of being
--   stored, so profiles saved before au_places was loaded still get distance matching.
-- * adzuna_match_candidates' p_locations now carries only the locations WITHOUT a map point
--   (states, unknown places), matched by name; a place with a point is matched by distance only,
--   so its name can't pull in jobs outside the chosen radius. "No location filter" now means no
--   points and no names. Callers still passing every location (and no points) get the previous
--   name-only behaviour, so this is safe to apply before the code deploys.

-- The trigger's UPDATE OF list references location_points, so it goes first.
drop trigger if exists job_profiles_touch on public.job_profiles;
alter table public.job_profiles drop column if exists location_points;
create trigger job_profiles_touch
  before insert or update of target_titles, skills, locations, remote_ok, min_salary, contract_types,
    seniority, resume_text, profile_text, embedding, search_radius_km
  on public.job_profiles
  for each row execute function public.job_profiles_touch();

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
       or (cardinality(p_locations) = 0 and jsonb_array_length(p_points) = 0)
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
