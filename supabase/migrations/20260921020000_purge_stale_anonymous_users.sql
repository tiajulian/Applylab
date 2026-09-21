-- ============================================================================================
-- Purge stale anonymous users
--
-- Supabase never cleans up anonymous auth users, and each one is a fresh identity with its own
-- free allowance, so an un-purged pile is both table bloat and a trail of throwaway accounts.
-- Deleting the auth.users row cascades to public.users and everything under it (on delete cascade).
--
-- Only removes users that are: still anonymous (a converted user has is_anonymous = false), idle
-- for p_idle_days, on the free plan with no Stripe customer. Bounded per run so a large backlog
-- can't hold locks for long; the daily schedule drains it.
-- ============================================================================================

create or replace function public.purge_stale_anonymous_users(
  p_idle_days integer default 30,
  p_batch_size integer default 1000
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if p_idle_days < 7 then
    raise exception 'purge_stale_anonymous_users: refusing idle window under 7 days';
  end if;

  with victims as (
    select au.id
      from auth.users au
      left join public.users pu on pu.id = au.id
     where au.is_anonymous
       and coalesce(au.last_sign_in_at, au.created_at) < now() - make_interval(days => p_idle_days)
       and coalesce(pu.plan, 'free') = 'free'
       and pu.stripe_customer_id is null
     order by au.created_at
     limit p_batch_size
  ),
  gone as (
    delete from auth.users au using victims v where au.id = v.id returning 1
  )
  select count(*) into v_deleted from gone;

  return v_deleted;
end;
$$;

revoke all on function public.purge_stale_anonymous_users(integer, integer) from public, anon, authenticated;
grant execute on function public.purge_stale_anonymous_users(integer, integer) to service_role;

-- Daily at 03:30 UTC when pg_cron is available. If it is not, call the function from any
-- scheduler as service_role: select public.purge_stale_anonymous_users();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-stale-anonymous-users', '30 3 * * *', 'select public.purge_stale_anonymous_users()');
  end if;
end;
$$;
