-- Job Matcher (Adzuna). Jobs are ingested daily into adzuna_* tables; matching never calls Adzuna
-- at request time.
--
-- Adzuna's terms require all Adzuna data to be removed if access ends. Everything Adzuna-sourced
-- lives in adzuna_jobs; job_interactions and job_matches cascade from it, so removal is:
--   delete from public.adzuna_jobs; delete from public.adzuna_categories;
--
-- All writes go through the API / ingestion worker with the service role. Users can only read
-- their own profile, interactions and matches; the adzuna_* tables have RLS on and no policies.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Jobs (Adzuna data only)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.adzuna_jobs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'adzuna',
  external_id text not null,
  title text not null,
  company text,
  description_snippet text not null default '',
  location_display text not null default '',
  location_area text[] not null default '{}',
  lat double precision,
  lng double precision,
  category_tag text,
  category_label text,
  salary_min integer,  -- AUD per year
  salary_max integer,  -- AUD per year
  salary_is_predicted boolean not null default false,
  contract_type text,
  contract_time text,
  redirect_url text not null,
  posted_at timestamptz,
  content_hash text not null,
  embedding extensions.vector(1536),  -- null until embedded; cleared when content_hash changes
  is_active boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (source, external_id)
);

create index if not exists adzuna_jobs_active_idx on public.adzuna_jobs (is_active);
create index if not exists adzuna_jobs_posted_at_idx on public.adzuna_jobs (posted_at desc);
create index if not exists adzuna_jobs_embedding_idx
  on public.adzuna_jobs using hnsw (embedding extensions.vector_cosine_ops);

alter table public.adzuna_jobs enable row level security;

-- Category list cache (GET /jobs/au/categories), refreshed at most every 30 days.
create table if not exists public.adzuna_categories (
  tag text primary key,
  label text not null,
  fetched_at timestamptz not null default now()
);

alter table public.adzuna_categories enable row level security;

-- ---------------------------------------------------------------------------------------------
-- Per-user profile, interactions and match cache
-- ---------------------------------------------------------------------------------------------
create table if not exists public.job_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  target_titles text[] not null default '{}',
  skills text[] not null default '{}',
  locations text[] not null default '{}',
  remote_ok boolean not null default false,
  min_salary integer,
  contract_types text[] not null default '{}',
  seniority text,
  resume_text text,
  profile_text text,  -- exact string that was embedded, for reproducible results
  embedding extensions.vector(1536),
  updated_at timestamptz not null default now()
);

alter table public.job_profiles enable row level security;

create policy "Users can view own job profile" on public.job_profiles
  for select using (auth.uid() = user_id);

create table if not exists public.job_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_id uuid not null references public.adzuna_jobs (id) on delete cascade,
  action text not null check (action in ('saved', 'dismissed', 'applied_click')),
  created_at timestamptz not null default now(),
  unique (user_id, job_id, action)
);

create index if not exists job_interactions_job_id_idx on public.job_interactions (job_id);

alter table public.job_interactions enable row level security;

create policy "Users can view own job interactions" on public.job_interactions
  for select using (auth.uid() = user_id);

create table if not exists public.job_matches (
  user_id uuid not null references public.users (id) on delete cascade,
  job_id uuid not null references public.adzuna_jobs (id) on delete cascade,
  score real not null,
  reasons jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now(),
  primary key (user_id, job_id)
);

create index if not exists job_matches_user_score_idx on public.job_matches (user_id, score desc);
create index if not exists job_matches_job_id_idx on public.job_matches (job_id);

alter table public.job_matches enable row level security;

create policy "Users can view own job matches" on public.job_matches
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------------------------
-- Adzuna call budget + ingestion runs
-- ---------------------------------------------------------------------------------------------
create table if not exists public.adzuna_api_usage (
  provider text not null,
  "window" text not null check ("window" in ('minute', 'day', 'week', 'month')),
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (provider, "window", window_start)
);

alter table public.adzuna_api_usage enable row level security;

-- Atomically checks all four windows (UTC) and, only if every one has room, counts one call.
-- Returns the first exhausted window when blocked, so the caller can wait out a minute window
-- but stop outright on a day/week/month one.
create or replace function public.adzuna_consume_call(
  p_provider text,
  p_limit_minute integer,
  p_limit_day integer,
  p_limit_week integer,
  p_limit_month integer
)
returns table (
  allowed boolean,
  blocked_window text,
  minute_count integer,
  day_count integer,
  week_count integer,
  month_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_starts timestamptz[] := array[
    date_trunc('minute', v_now, 'UTC'),
    date_trunc('day', v_now, 'UTC'),
    date_trunc('week', v_now, 'UTC'),
    date_trunc('month', v_now, 'UTC')
  ];
  v_windows text[] := array['minute', 'day', 'week', 'month'];
  v_limits integer[] := array[p_limit_minute, p_limit_day, p_limit_week, p_limit_month];
  v_counts integer[] := array[0, 0, 0, 0];
  i integer;
begin
  perform pg_advisory_xact_lock(hashtextextended('adzuna_consume_call:' || p_provider, 0));

  for i in 1..4 loop
    v_counts[i] := coalesce((
      select u.count from public.adzuna_api_usage u
       where u.provider = p_provider and u."window" = v_windows[i] and u.window_start = v_starts[i]
    ), 0);
  end loop;

  for i in 1..4 loop
    if v_counts[i] >= v_limits[i] then
      return query select false, v_windows[i], v_counts[1], v_counts[2], v_counts[3], v_counts[4];
      return;
    end if;
  end loop;

  for i in 1..4 loop
    insert into public.adzuna_api_usage (provider, "window", window_start, count)
    values (p_provider, v_windows[i], v_starts[i], 1)
    on conflict (provider, "window", window_start) do update set count = adzuna_api_usage.count + 1;
    v_counts[i] := v_counts[i] + 1;
  end loop;

  -- Old windows are only ever needed for the current month.
  delete from public.adzuna_api_usage
   where provider = p_provider and window_start < v_starts[4] - interval '35 days';

  return query select true, null::text, v_counts[1], v_counts[2], v_counts[3], v_counts[4];
end;
$$;

create table if not exists public.adzuna_ingest_runs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  summary jsonb
);

-- At most one running ingestion: the insert of a second 'running' row fails on this index.
create unique index if not exists adzuna_ingest_runs_one_running_idx
  on public.adzuna_ingest_runs ((true)) where status = 'running';
create index if not exists adzuna_ingest_runs_started_idx on public.adzuna_ingest_runs (started_at desc);

alter table public.adzuna_ingest_runs enable row level security;

-- Upserts a batch of mapped jobs by (source, external_id). last_seen_at always moves; the
-- embedding is cleared only when content_hash changes so unchanged jobs are never re-embedded.
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
      lat = excluded.lat,
      lng = excluded.lng,
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

-- Near-duplicates (same normalised title + company + location, posted within 7 days of the
-- newest copy) keep only the newest active row.
create or replace function public.adzuna_dedupe_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with ranked as (
    select id, posted_at,
           first_value(posted_at) over w as newest_posted_at,
           row_number() over w as rn
      from public.adzuna_jobs
     where is_active
    window w as (
      partition by lower(regexp_replace(title, '\s+', ' ', 'g')),
                   lower(coalesce(company, '')),
                   lower(location_display)
      order by posted_at desc nulls last, last_seen_at desc
    )
  )
  update public.adzuna_jobs j
     set is_active = false
    from ranked r
   where j.id = r.id
     and r.rn > 1
     and (r.posted_at is null or r.newest_posted_at - r.posted_at <= interval '7 days');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.adzuna_expire_jobs(p_not_seen_days integer, p_max_age_days integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.adzuna_jobs
     set is_active = false
   where is_active
     and (last_seen_at < now() - make_interval(days => p_not_seen_days)
          or posted_at < now() - make_interval(days => p_max_age_days));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.adzuna_consume_call(text, integer, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.adzuna_upsert_jobs(jsonb) from public, anon, authenticated;
revoke all on function public.adzuna_dedupe_jobs() from public, anon, authenticated;
revoke all on function public.adzuna_expire_jobs(integer, integer) from public, anon, authenticated;
grant execute on function public.adzuna_consume_call(text, integer, integer, integer, integer) to service_role;
grant execute on function public.adzuna_upsert_jobs(jsonb) to service_role;
grant execute on function public.adzuna_dedupe_jobs() to service_role;
grant execute on function public.adzuna_expire_jobs(integer, integer) to service_role;
