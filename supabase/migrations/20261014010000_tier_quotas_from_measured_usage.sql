-- Credit quotas set from measured ledger usage (pricing brief 9.4, measured 14 Oct 2026 over the
-- last 30 days: 985 committed calls, 7 users - a small sample, re-check once there's more traffic).
--
-- Free (lifetime): p90 core journey (profile -> 1 tailored resume) = 16.4 credits, plus every free
-- per-feature cap (lib/limits.ts) used once at average cost ~98 credits (unmeasured features
-- counted at 2 credits each) = ~114, rounded up to the next 50 = 150. The core-journey calls are
-- also exempt from this quota (callGateway's exemptFromQuota), so it can never block the free
-- resume - it only bounds the optional helpers.
--
-- Pro (monthly): measured p99 = 124 credits, so 3 x p99 = 372; the floor of 3,000 applies, so it
-- stays at 3,000. Max AI cost = 3,000 x US$0.001 = US$3 (about A$4.60), roughly 17% of A$29 ex GST
-- (A$26.36) - under the 40% ceiling.
--
-- No effect until AI_GATEWAY_LIVE_ENFORCEMENT=true (every call site is still in shadow mode).

update public.tier_quotas set credits_per_window = 150, updated_at = now() where tier = 'free';
update public.tier_quotas set credits_per_window = 3000, updated_at = now() where tier = 'pro';
