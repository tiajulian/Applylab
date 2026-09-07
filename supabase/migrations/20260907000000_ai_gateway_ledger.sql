-- ============================================================================================
-- AI Gateway: credit-pool metering and enforcement, generalizing the atomic reserve-before-spend
-- pattern already proven by increment_resumes_used / increment_assist_calls /
-- increment_content_score_count (see the definitions further up this file) across every AI
-- feature instead of one counter column per feature. See docs/ai-metering-audit (Phase 0 audit)
-- and the free-tier-ai-limiting-spec for the design this implements.
--
-- Two tables:
--   tier_quotas     - one row per tier, editable in place so a quota change never needs a
--                     deploy. The whole point of this table existing separately from code.
--   ai_usage_ledger - one row per AI call (reservation through commit/refund), successor to
--                     api_cost_log for anything gated by the gateway. Remaining balance for a
--                     window is sum(credits_reserved) where status in ('reserved','committed')
--                     and created_at >= window_start - computed by reserve_ai_credits below, and
--                     readable directly for dashboards. window_start is NULL for a 'lifetime'
--                     tier (free - spec §2): no lower bound, i.e. summed over all time, and never
--                     reset by a cron job. Only a windowed (monthly/daily) tier passes a real
--                     window_start.
--
-- api_cost_log is NOT replaced by this migration - routes not yet ported to the gateway keep
-- logging there until they're migrated (see the spec's migration order). Both tables coexist
-- during the transition.
-- ============================================================================================

create table if not exists public.tier_quotas (
  tier text primary key,
  credits_per_window int not null,
  -- Named quota_window, not window - `window` is a reserved SQL keyword (window functions) and
  -- fails to parse unquoted in a column definition.
  quota_window text not null default 'monthly' check (quota_window in ('lifetime', 'daily', 'monthly')),
  -- Free-tier fan-out policy (spec §6/§7): a multi-step flow checks budget before each call and
  -- stops early once fanned-out calls for one logical action would exceed this count, serving a
  -- partial result instead. Null means "no fan-out cap" (Pro: pay full cost, no cap).
  max_fanout_per_call int,
  updated_at timestamptz not null default now()
);

alter table public.tier_quotas enable row level security;

-- Any signed-in user can read quotas (needed to render "X of Y used" UI without a service-role
-- round trip); only ever written by hand/migration or a future admin route, never by a client.
-- drop-then-create (unlike schema.sql's policies, which have no IF NOT EXISTS and aren't safe to
-- rerun) so this migration itself is idempotent - needed for a local Postgres reset/reapply cycle
-- (e.g. `supabase db reset` during integration testing) to not fail on a second run.
drop policy if exists "Any authenticated user can read tier quotas" on public.tier_quotas;
create policy "Any authenticated user can read tier quotas" on public.tier_quotas
  for select to authenticated using (true);

-- PLACEHOLDER VALUES - both still owned by the founder (spec §14), not verified against real
-- provider-bill totals yet. Free is 'lifetime' (spec §2): granted once per account, never reset -
-- sized off the §1 allowance (1 resume + ~5 assists + 1 content-score + 1 cover-letter) using the
-- measured/estimated per-feature costs from the audit's cost reconciliation (~28 credits at
-- 1 credit = $0.001) with headroom for estimation error. Pro is 'monthly', a placeholder "bigger
-- pool" not derived from any real Pro usage data. Change in place here (or via a follow-up
-- UPDATE) once real numbers land - no deploy required either way, that's this table's whole
-- purpose.
insert into public.tier_quotas (tier, credits_per_window, quota_window, max_fanout_per_call)
values
  ('free', 40, 'lifetime', 1),
  ('pro', 2000, 'monthly', null)
on conflict (tier) do nothing;

create table if not exists public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tier text not null,
  feature text not null,
  provider text not null,
  model text not null,
  credits_reserved int not null,
  credits_actual int,
  status text not null default 'reserved' check (status in ('reserved', 'committed', 'refunded', 'failed')),
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cache_creation_input_tokens int not null default 0,
  cache_read_input_tokens int not null default 0,
  cost_usd numeric(10, 6) not null default 0,
  created_at timestamptz not null default now(),
  committed_at timestamptz
);

create index if not exists ai_usage_ledger_user_window_idx
  on public.ai_usage_ledger (user_id, created_at);
create index if not exists ai_usage_ledger_status_idx
  on public.ai_usage_ledger (status)
  where status = 'reserved';

alter table public.ai_usage_ledger enable row level security;
-- No client-facing policies at all, same lockdown as api_cost_log (see that table's comment) -
-- every read and write goes through the RPCs below or a service-role admin route.

-- Reserves p_estimated_credits for one AI call if the user's window balance can absorb it,
-- inserting a 'reserved' ledger row and returning its id - or returns null (no row inserted, no
-- provider call should be made) if the balance can't cover it. security definer + the
-- user_id = auth.uid() check mirror increment_resumes_used above: called through the caller's own
-- authenticated session (lib/supabase/server.ts createClient()), never the service-role client,
-- so a user can only ever reserve against their own balance.
--
-- Atomicity: pg_advisory_xact_lock serializes concurrent reservations for the same user_id within
-- this transaction (auto-released at commit/rollback, so a crashed request can't hold it) - the
-- balance-then-insert here is a read-then-write, but no two concurrent calls for the same user can
-- interleave between the read and the write. hashtext collisions across different users would
-- only ever cause unrelated users to serialize against each other (a performance cost, not a
-- correctness bug) - never allow two different users to share a balance.
create or replace function public.reserve_ai_credits(
  p_user_id uuid,
  p_tier text,
  p_feature text,
  p_provider text,
  p_model text,
  p_estimated_credits int,
  -- NULL means a 'lifetime' tier (spec §2/§11): sum over all time, no lower bound. A windowed
  -- tier (monthly/daily) passes its real window start. Left as a bare `= p_window_start` this
  -- would silently exclude every row once p_window_start is NULL (SQL: created_at >= NULL is
  -- NULL, never true) and hand out unlimited credits - see the `is null or` guard below.
  p_window_start timestamptz,
  p_quota int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
  v_ledger_id uuid;
begin
  if p_user_id != auth.uid() then
    raise exception 'reserve_ai_credits: user_id does not match caller';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_user_id::text)::bigint);

  -- A 'reserved' row still counts its held estimate (the spend isn't resolved yet); a
  -- 'committed' row counts its real cost instead, so an over-estimated reservation releases its
  -- surplus back to the pool the moment it commits, and an under-estimated one is reflected
  -- accurately for every reservation checked after it (never retroactively for itself - the
  -- provider call already happened by the time actual cost is known).
  --
  -- A 'reserved' row older than 10 minutes is excluded from the balance entirely - no cron/sweep
  -- exists to expire an orphaned reservation (e.g. the process crashed between reserve and
  -- commit/refund), so self-healing after a short window is what keeps a stranded reservation
  -- from locking those credits forever. 10 minutes is well beyond every AI route's own
  -- maxDuration (120s at the longest today), so a reservation still 'reserved' past that is
  -- overwhelmingly an orphan, not a slow in-flight call.
  select coalesce(sum(case when status = 'committed' then credits_actual else credits_reserved end), 0)
    into v_used
  from public.ai_usage_ledger
  where user_id = p_user_id
    and (p_window_start is null or created_at >= p_window_start)
    and (
      status = 'committed'
      or (status = 'reserved' and created_at >= now() - interval '10 minutes')
    );

  if v_used + p_estimated_credits > p_quota then
    return null;
  end if;

  insert into public.ai_usage_ledger (user_id, tier, feature, provider, model, credits_reserved, status)
  values (p_user_id, p_tier, p_feature, p_provider, p_model, p_estimated_credits, 'reserved')
  returning id into v_ledger_id;

  return v_ledger_id;
end;
$$;

-- Replaces a reservation's estimate with the real token counts/cost once the provider call
-- succeeds. Only ever transitions a row this same user reserved, and only from 'reserved' - a
-- second commit against an already-committed/refunded row is a no-op (row_count = 0), not an
-- error, so a caller retrying its own reconcile step after a network blip can't double-commit.
create or replace function public.commit_ai_credits(
  p_ledger_id uuid,
  p_user_id uuid,
  p_credits_actual int,
  p_input_tokens int,
  p_output_tokens int,
  p_cache_creation_input_tokens int,
  p_cache_read_input_tokens int,
  p_cost_usd numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_user_id != auth.uid() then
    raise exception 'commit_ai_credits: user_id does not match caller';
  end if;

  update public.ai_usage_ledger
  set status = 'committed',
      credits_actual = p_credits_actual,
      input_tokens = p_input_tokens,
      output_tokens = p_output_tokens,
      cache_creation_input_tokens = p_cache_creation_input_tokens,
      cache_read_input_tokens = p_cache_read_input_tokens,
      cost_usd = p_cost_usd,
      committed_at = now()
  where id = p_ledger_id
    and user_id = p_user_id
    and status = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Releases a reservation's credits back to the pool on provider failure - a refunded row still
-- counts toward neither balance (see reserve_ai_credits's status filter) but stays in the ledger
-- for observability (failed-call rate, retry accounting). Only transitions from 'reserved', same
-- no-op-on-repeat safety as commit above.
create or replace function public.refund_ai_credits(
  p_ledger_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if p_user_id != auth.uid() then
    raise exception 'refund_ai_credits: user_id does not match caller';
  end if;

  update public.ai_usage_ledger
  set status = 'refunded'
  where id = p_ledger_id
    and user_id = p_user_id
    and status = 'reserved';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.reserve_ai_credits(uuid, text, text, text, text, int, timestamptz, int) to authenticated;
grant execute on function public.commit_ai_credits(uuid, uuid, int, int, int, int, int, numeric) to authenticated;
grant execute on function public.refund_ai_credits(uuid, uuid) to authenticated;
