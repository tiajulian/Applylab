-- Lifetime has been discontinued (never sold) — Pro is now the only paid plan.
-- Confirmed no existing rows have plan = 'lifetime' before applying this.
alter table public.users drop constraint if exists users_plan_check;
alter table public.users add constraint users_plan_check check (plan in ('free', 'pro'));
