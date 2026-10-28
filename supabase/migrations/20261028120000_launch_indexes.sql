-- Indexes for lookups that scan whole tables today.
-- The public resume scorer reuses a recent score for identical text (by review_content_hash).
create index if not exists resumes_review_content_hash_idx
  on public.resumes (review_content_hash)
  where review_overall_score is not null;

-- The Stripe webhook finds the user by their Stripe customer.
create index if not exists users_stripe_customer_id_idx
  on public.users (stripe_customer_id)
  where stripe_customer_id is not null;

-- Unindexed foreign key (Supabase performance advisor).
create index if not exists resumes_skills_bridge_id_idx
  on public.resumes (skills_bridge_id);
