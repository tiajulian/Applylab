-- Set by the Stripe webhook while a Pro subscription is past_due (Stripe is retrying a failed card),
-- cleared when the payment goes through or the subscription ends. Drives the "update your card"
-- banner in the dashboard. Not in the authenticated column update grant on public.users
-- (supabase/schema.sql), so only the service role can write it.

alter table public.users
  add column if not exists payment_failed boolean not null default false;
