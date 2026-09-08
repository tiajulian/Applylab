-- ============================================================================================
-- Lets a user read their own free_tier_feature_usage rows directly (e.g. to render a "2 of 2
-- cover letters used" indicator on their own dashboard - spec §10/§15's "show remaining quota so
-- limits don't feel like a surprise"). The table shipped with zero client-facing policies
-- (20260907020000_free_tier_feature_limits.sql), same total lockdown as ai_usage_ledger, on the
-- assumption that only the reserve/refund RPCs would ever touch it - reading your own usage count
-- is a legitimate, safe use case that lockdown didn't need to block, so this is an incremental
-- follow-up (not an edit to that already-shipped migration - see the schema.sql non-idempotency
-- note elsewhere in this repo for why migrations aren't rewritten in place after the fact).
--
-- Same shape as tier_quotas' own "any authenticated user can read" policy, just scoped to the
-- caller's own rows instead of every row (tier_quotas is shared config, this is per-user data).
-- Writes still go exclusively through increment/decrement_free_tier_feature_usage - this adds
-- read-only, own-row-only access, nothing else.
-- ============================================================================================

drop policy if exists "Users can read their own free-tier feature usage" on public.free_tier_feature_usage;
create policy "Users can read their own free-tier feature usage" on public.free_tier_feature_usage
  for select to authenticated using (user_id = auth.uid());
