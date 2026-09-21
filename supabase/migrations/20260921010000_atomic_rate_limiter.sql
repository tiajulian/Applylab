-- ============================================================================================
-- Atomic rate limiter + concurrency leases
--
-- Replaces the read-count-then-insert flow over public.rate_limit_hits (racy: parallel requests
-- all read "under the limit" and all pass) with ONE function call per check:
--   * rate_limit_hit      - sliding-window-counter (current + weighted previous bucket), atomic
--                           per key via a transaction-scoped advisory lock. O(1) rows per key
--                           instead of one row per request.
--   * concurrency_acquire - per-key lease slots with a TTL, for long-running routes.
--
-- Service-role only (same lockdown as the old table). rate_limit_hits is left in place so the
-- previous deploy keeps working during rollout; drop it in a later migration.
-- ============================================================================================

create table if not exists public.rate_limit_windows (
  rate_key text not null,
  window_start bigint not null,  -- epoch seconds, aligned to the window size
  hits integer not null default 0,
  expires_at timestamptz not null,
  primary key (rate_key, window_start)
);

create index if not exists rate_limit_windows_expires_idx on public.rate_limit_windows (expires_at);

create table if not exists public.concurrency_leases (
  id uuid primary key default gen_random_uuid(),
  lease_key text not null,
  expires_at timestamptz not null
);

create index if not exists concurrency_leases_key_idx on public.concurrency_leases (lease_key, expires_at);

alter table public.rate_limit_windows enable row level security;
alter table public.concurrency_leases enable row level security;

-- Deletes expired state. Also called opportunistically (1% of calls) below, so it works without
-- pg_cron; a cron schedule at the bottom is added only if the extension exists.
create or replace function public.purge_rate_limit_state()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.rate_limit_windows where expires_at < now();
  delete from public.concurrency_leases where expires_at < now();
$$;

-- Returns one row. `allowed` false means over the limit; a rejected call is NOT counted, so a
-- client hammering a closed door doesn't extend its own lockout.
create or replace function public.rate_limit_hit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now double precision := extract(epoch from clock_timestamp());
  v_cur bigint := floor(v_now / p_window_seconds)::bigint * p_window_seconds;
  v_elapsed double precision := v_now - v_cur;
  v_cur_hits integer;
  v_prev_hits integer;
  v_weighted double precision;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'rate_limit_hit: max and window must be >= 1';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_key, 0));

  select coalesce(sum(hits) filter (where window_start = v_cur), 0),
         coalesce(sum(hits) filter (where window_start = v_cur - p_window_seconds), 0)
    into v_cur_hits, v_prev_hits
    from public.rate_limit_windows
   where rate_key = p_key and window_start >= v_cur - p_window_seconds;

  v_weighted := v_prev_hits * (1 - v_elapsed / p_window_seconds) + v_cur_hits;

  if v_weighted + 1 > p_max then
    allowed := false;
    remaining := 0;
    retry_after_seconds := greatest(1, ceil(p_window_seconds - v_elapsed)::integer);
    return next;
    return;
  end if;

  insert into public.rate_limit_windows (rate_key, window_start, hits, expires_at)
  values (p_key, v_cur, 1, to_timestamp(v_cur + 2 * p_window_seconds))
  on conflict (rate_key, window_start)
  do update set hits = public.rate_limit_windows.hits + 1;

  if random() < 0.01 then
    perform public.purge_rate_limit_state();
  end if;

  allowed := true;
  remaining := greatest(0, floor(p_max - (v_weighted + 1))::integer);
  retry_after_seconds := 0;
  return next;
end;
$$;

-- Returns a lease id, or null when p_max leases for this key are already live. The lease
-- self-expires after p_ttl_seconds, so a crashed invocation can't hold a slot forever.
create or replace function public.concurrency_acquire(
  p_key text,
  p_max integer,
  p_ttl_seconds integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('lease:' || p_key, 0));

  delete from public.concurrency_leases where lease_key = p_key and expires_at < now();

  if (select count(*) from public.concurrency_leases where lease_key = p_key) >= p_max then
    return null;
  end if;

  insert into public.concurrency_leases (lease_key, expires_at)
  values (p_key, now() + make_interval(secs => p_ttl_seconds))
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.concurrency_release(p_lease_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.concurrency_leases where id = p_lease_id;
$$;

revoke all on function public.purge_rate_limit_state() from public, anon, authenticated;
revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.concurrency_acquire(text, integer, integer) from public, anon, authenticated;
revoke all on function public.concurrency_release(uuid) from public, anon, authenticated;
grant execute on function public.purge_rate_limit_state() to service_role;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.concurrency_acquire(text, integer, integer) to service_role;
grant execute on function public.concurrency_release(uuid) to service_role;

-- Belt and braces for the opportunistic purge: hourly sweep when pg_cron is available.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-rate-limit-state', '17 * * * *', 'select public.purge_rate_limit_state()');
  end if;
end;
$$;
