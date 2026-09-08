-- ============================================================================================
-- Replaces app/api/admin/gateway-usage/route.ts's previous approach - pulling every
-- ai_usage_ledger row into Node and reducing byStatus/byFeature/byTier/topUsers in JS - with a
-- single SQL GROUP BY per breakdown. That JS approach was fine while the ledger was tiny
-- (shadow-mode only, see the ledger migration's own note), but scales linearly with total calls
-- ever made instead of with the number of distinct features/tiers/users, and pulls the full
-- cost_usd/credits_actual of every row over the wire just to sum a handful of numbers.
--
-- Returns one JSON object rather than a relational `returns table` shape, since several of ITS
-- own fields (byFeature, byTier, topUsers) are themselves arrays of rows - easier to assemble
-- with json_build_object + json_agg than to fight a single flat table shape into that.
-- ============================================================================================

create or replace function public.admin_ai_gateway_ledger_summary(p_stale_minutes int default 10)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'totalRows', (select count(*) from public.ai_usage_ledger),
    'byStatus', (
      select coalesce(json_object_agg(status, cnt), '{}'::json)
      from (select status, count(*) as cnt from public.ai_usage_ledger group by status) s
    ),
    'byFeature', (
      select coalesce(json_agg(t order by t."creditsCommitted" desc), '[]'::json)
      from (
        select feature,
               count(*) as calls,
               coalesce(sum(credits_actual), 0) as "creditsCommitted",
               coalesce(sum(cost_usd), 0) as "costUsd"
        from public.ai_usage_ledger
        where status = 'committed'
        group by feature
      ) t
    ),
    'byTier', (
      select coalesce(json_agg(t order by t."creditsCommitted" desc), '[]'::json)
      from (
        select tier,
               count(*) as calls,
               coalesce(sum(credits_actual), 0) as "creditsCommitted",
               coalesce(sum(cost_usd), 0) as "costUsd"
        from public.ai_usage_ledger
        where status = 'committed'
        group by tier
      ) t
    ),
    -- Joined directly in SQL instead of the previous two-step "aggregate user_ids in JS, then a
    -- second `.in('id', topUserIds)` round trip to look up email/plan" dance.
    'topUsers', (
      select coalesce(json_agg(t order by t."creditsCommitted" desc), '[]'::json)
      from (
        select l.user_id as "userId",
               usr.email,
               usr.plan,
               sum(l.credits_actual) as "creditsCommitted",
               count(*) as calls
        from public.ai_usage_ledger l
        join public.users usr on usr.id = l.user_id
        where l.status = 'committed'
        group by l.user_id, usr.email, usr.plan
        order by sum(l.credits_actual) desc
        limit 10
      ) t
    ),
    'staleReservationCount', (
      select count(*)
      from public.ai_usage_ledger
      where status = 'reserved'
        and created_at < now() - make_interval(mins => p_stale_minutes)
    )
  );
$$;

-- service_role only - this aggregates every user's spend/usage across the whole ledger, not just
-- the caller's own rows (unlike reserve/commit/refund_ai_credits, which check auth.uid()). Must
-- never be reachable from a client holding only the anon/authenticated key: the admin check
-- (requireAdmin()) lives entirely in the Next.js route, not in this function, so granting this to
-- `authenticated` would let any signed-in user call it directly via supabase-js and read every
-- user's committed spend.
grant execute on function public.admin_ai_gateway_ledger_summary(int) to service_role;
