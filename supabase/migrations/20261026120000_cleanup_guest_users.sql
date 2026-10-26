-- Onboarding saves progress under a guest (anonymous) Supabase session before signup. Visitors
-- who never sign up leave those guest accounts behind, so one that is still a guest 30 days after
-- it was made is deleted daily. A guest who signs up becomes a permanent user (is_anonymous =
-- false) and is never touched. Every public table cascades from auth.users / public.users, so
-- the guest's rows go with it.
create extension if not exists pg_cron;

select cron.schedule(
  'cleanup-guest-users',
  '0 17 * * *', -- 17:00 UTC = 3-4am Sydney time
  $$delete from auth.users where is_anonymous and created_at < now() - interval '30 days'$$
);
