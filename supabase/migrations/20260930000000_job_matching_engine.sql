-- Job Matcher phase 3: job embeddings, candidate recall and the per-user match cache.

-- Writes embeddings for a batch of jobs. The content_hash guard skips a job whose text changed
-- after it was read for embedding, so a stale vector is never stored against new content.
create or replace function public.adzuna_set_job_embeddings(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_count integer;
begin
  update public.adzuna_jobs j
     set embedding = (r ->> 'embedding')::extensions.vector
    from jsonb_array_elements(p_rows) r
   where j.id = (r ->> 'id')::uuid
     and j.content_hash = r ->> 'content_hash';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Stages 1-2 of matching: hard filters, then the nearest jobs by cosine distance. Jobs with an
-- unknown salary, contract type or contract time are kept rather than filtered out.
create or replace function public.adzuna_match_candidates(
  p_embedding extensions.vector,
  p_locations text[],
  p_remote_ok boolean,
  p_min_salary integer,
  p_contract_types text[],
  p_user_id uuid,
  p_limit integer default 200
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
  -- Filters run after the HNSW scan; iterative scanning keeps pulling candidates until p_limit
  -- rows pass them instead of returning only the first ef_search neighbours.
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
       cardinality(p_locations) = 0
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

-- Atomically swaps a user's cached matches, so readers never see a half-written list.
create or replace function public.job_matches_replace(p_user_id uuid, p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.job_matches where user_id = p_user_id;
  insert into public.job_matches (user_id, job_id, score, reasons)
  select p_user_id, r.job_id, r.score, r.reasons
    from jsonb_to_recordset(p_rows) as r (job_id uuid, score real, reasons jsonb);
end;
$$;

create index if not exists job_profiles_updated_at_idx on public.job_profiles (updated_at);

revoke all on function public.adzuna_set_job_embeddings(jsonb) from public, anon, authenticated;
revoke all on function public.adzuna_match_candidates(extensions.vector, text[], boolean, integer, text[], uuid, integer) from public, anon, authenticated;
revoke all on function public.job_matches_replace(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.adzuna_set_job_embeddings(jsonb) to service_role;
grant execute on function public.adzuna_match_candidates(extensions.vector, text[], boolean, integer, text[], uuid, integer) to service_role;
grant execute on function public.job_matches_replace(uuid, jsonb) to service_role;
