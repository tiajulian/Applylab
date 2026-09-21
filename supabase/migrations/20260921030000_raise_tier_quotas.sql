-- Raise the AI credit allowances (1 credit = $0.001).
--   free: 40 -> 60 (lifetime, granted once per account)
--   pro:  2000 -> 3000 (per calendar month, UTC)
-- Still placeholders, not derived from real usage. The original seed used ON CONFLICT DO NOTHING,
-- so an UPDATE is needed to change rows that already exist. Takes effect immediately, no deploy.
update public.tier_quotas set credits_per_window = 60 where tier = 'free';
update public.tier_quotas set credits_per_window = 3000 where tier = 'pro';
