-- ============================================================================================
-- Free-tier account-level limits for the AI features that, until now, had only a per-hour
-- anti-abuse stopgap (see the free-tier-ai-limiting-spec §12 step 1 stopgaps) and no lifetime
-- account cap the way generate-resume (resumes_used) and assist (assist_calls_used) already had.
-- An hourly cap alone bounds a burst; it does nothing to stop a free user calling an AI feature a
-- few times a day forever. This closes that gap with the same lifetime-per-account shape as
-- resumes_used, generalized to one table instead of a new column per feature.
--
-- Deliberately a separate, simpler mechanism from the AI gateway's credit ledger
-- (20260907000000_ai_gateway_ledger.sql) - that one is still shadow-mode/not enforcing anything
-- (see lib/aiGateway/gateway.ts's AI_GATEWAY_LIVE_ENFORCEMENT), and its rollout has its own
-- 4-item checklist before it can replace per-feature counters as the real gate. This table is the
-- same proven, already-live pattern as increment_resumes_used, just parameterized by feature name
-- instead of hardcoded to one column - a real, immediate fix, not a placeholder for the gateway.
-- ============================================================================================

create table if not exists public.free_tier_feature_usage (
  user_id uuid not null references public.users (id) on delete cascade,
  feature text not null,
  count int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature)
);

alter table public.free_tier_feature_usage enable row level security;
-- No client-facing policies at all, same lockdown as ai_usage_ledger - every read and write goes
-- through the RPCs below (security definer + auth.uid() check), never a direct client query.

-- Atomically reserves one use of p_feature for p_user_id if they're under p_limit (null = no
-- limit, i.e. Pro) - inserts the row on first use, then a conditional UPDATE ... WHERE count <
-- p_limit. Two statements, not one, but still race-safe: Postgres's row lock on the UPDATE
-- serializes concurrent callers for the same (user_id, feature) row, so a second concurrent call
-- always sees the first's committed count before its own WHERE clause is evaluated - the same
-- safety property increment_resumes_used gets from a single UPDATE, just split because a row
-- might not exist yet on a user's first call to a given feature.
create or replace function public.increment_free_tier_feature_usage(
  p_user_id uuid,
  p_feature text,
  p_limit int
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
    raise exception 'increment_free_tier_feature_usage: user_id does not match caller';
  end if;

  insert into public.free_tier_feature_usage (user_id, feature, count)
  values (p_user_id, p_feature, 0)
  on conflict (user_id, feature) do nothing;

  update public.free_tier_feature_usage
  set count = count + 1,
      updated_at = now()
  where user_id = p_user_id
    and feature = p_feature
    and (p_limit is null or count < p_limit);

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Best-effort refund after a failed generation, same shape as decrement_resumes_used.
create or replace function public.decrement_free_tier_feature_usage(
  p_user_id uuid,
  p_feature text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id != auth.uid() then
    raise exception 'decrement_free_tier_feature_usage: user_id does not match caller';
  end if;

  update public.free_tier_feature_usage
  set count = greatest(count - 1, 0),
      updated_at = now()
  where user_id = p_user_id
    and feature = p_feature;
end;
$$;

grant execute on function public.increment_free_tier_feature_usage(uuid, text, int) to authenticated;
grant execute on function public.decrement_free_tier_feature_usage(uuid, text) to authenticated;
