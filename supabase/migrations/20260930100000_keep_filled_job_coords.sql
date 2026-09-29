-- Re-ingesting a job that Adzuna sends without coordinates no longer wipes the coordinates that
-- adzuna_fill_job_coords() gave it, so those jobs stay in distance searches between runs. Also
-- backfills coordinates here so a fresh environment doesn't wait for the next ingestion.

create or replace function public.adzuna_upsert_jobs(p_rows jsonb)
returns table (inserted integer, updated integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with upserted as (
    insert into public.adzuna_jobs as j (
      source, external_id, title, company, description_snippet, location_display, location_area,
      lat, lng, category_tag, category_label, salary_min, salary_max, salary_is_predicted,
      contract_type, contract_time, redirect_url, posted_at, content_hash
    )
    select
      coalesce(r.source, 'adzuna'), r.external_id, r.title, r.company, coalesce(r.description_snippet, ''),
      coalesce(r.location_display, ''), coalesce(r.location_area, '{}'), r.lat, r.lng, r.category_tag,
      r.category_label, r.salary_min, r.salary_max, coalesce(r.salary_is_predicted, false),
      r.contract_type, r.contract_time, r.redirect_url, r.posted_at, r.content_hash
    from jsonb_to_recordset(p_rows) as r (
      source text, external_id text, title text, company text, description_snippet text,
      location_display text, location_area text[], lat double precision, lng double precision,
      category_tag text, category_label text, salary_min integer, salary_max integer,
      salary_is_predicted boolean, contract_type text, contract_time text, redirect_url text,
      posted_at timestamptz, content_hash text
    )
    on conflict (source, external_id) do update set
      title = excluded.title,
      company = excluded.company,
      description_snippet = excluded.description_snippet,
      location_display = excluded.location_display,
      location_area = excluded.location_area,
      -- Adzuna omits coordinates for some jobs; keep the ones adzuna_fill_job_coords() filled in.
      lat = case when excluded.lat is null or (excluded.lat = 0 and excluded.lng = 0) then j.lat else excluded.lat end,
      lng = case when excluded.lat is null or (excluded.lat = 0 and excluded.lng = 0) then j.lng else excluded.lng end,
      category_tag = excluded.category_tag,
      category_label = excluded.category_label,
      salary_min = excluded.salary_min,
      salary_max = excluded.salary_max,
      salary_is_predicted = excluded.salary_is_predicted,
      contract_type = excluded.contract_type,
      contract_time = excluded.contract_time,
      redirect_url = excluded.redirect_url,
      posted_at = excluded.posted_at,
      content_hash = excluded.content_hash,
      embedding = case when j.content_hash is distinct from excluded.content_hash then null else j.embedding end,
      is_active = true,
      last_seen_at = now()
    returning (xmax = 0) as was_inserted
  )
  select count(*) filter (where was_inserted)::integer, count(*) filter (where not was_inserted)::integer
    from upserted;
end;
$$;

select public.adzuna_fill_job_coords();
