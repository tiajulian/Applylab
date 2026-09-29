-- Jobs Adzuna sends without coordinates (about 1 in 6) get them once, at ingestion, from their
-- most specific Adzuna area name found in au_places (in the same state). Matching then compares
-- plain coordinates instead of re-resolving those jobs on every match.

create or replace function public.adzuna_fill_job_coords()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with resolved as (
    select j.id, p.lat, p.lng
      from public.adzuna_jobs j
      cross join lateral (
        select ap.lat, ap.lng
          from unnest(j.location_area) with ordinality as a (name, pos)
          join public.au_places ap
            on ap.name_key = lower(a.name)
           and (cardinality(j.location_area) < 2 or ap.state = j.location_area[2])
         order by a.pos desc
         limit 1
      ) p
     where j.is_active
       and (j.lat is null or j.lng is null or (j.lat = 0 and j.lng = 0))
  )
  update public.adzuna_jobs t
     set lat = r.lat, lng = r.lng
    from resolved r
   where t.id = r.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.adzuna_fill_job_coords() from public, anon, authenticated;
grant execute on function public.adzuna_fill_job_coords() to service_role;

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
       or (j.lat is not null and not (j.lat = 0 and j.lng = 0) and exists (
         select 1 from jsonb_to_recordset(p_points) as pt (lat double precision, lng double precision)
          where public.km_between(pt.lat, pt.lng, j.lat, j.lng) <= p_radius_km
       ))
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
