-- Backfill for 20261013000000_resume_free_allowance.sql. Already applied to production by hand on
-- 14 Oct 2026 (3 rows). Kept exactly as it ran; don't re-run it.
--
-- Marks the earliest resume of each user who is on the free plan today AND has never had a Stripe
-- customer. Users who downgraded from Pro (stripe_customer_id set) get no backfilled free resume:
-- their old resumes stay locked behind Pro or the A$2.99 unlock.
--
-- Dry run (count only):
--   select count(*) from (
--     select distinct on (r.user_id) r.id
--     from public.resumes r join public.users u on u.id = r.user_id
--     where u.plan = 'free' and u.stripe_customer_id is null
--     order by r.user_id, r.created_at, r.id
--   ) first_resumes;

update public.resumes r
set is_free_allowance = true
from (
  select distinct on (r2.user_id) r2.id
  from public.resumes r2
  join public.users u on u.id = r2.user_id
  where u.plan = 'free'
    and u.stripe_customer_id is null
  order by r2.user_id, r2.created_at, r2.id
) first_resumes
where r.id = first_resumes.id
  and not r.is_free_allowance;
