-- ============================================================================================
-- Persistent Rate Limit Hits Table
-- Provides shared, cross-instance rate limiting across Vercel serverless functions.
-- ============================================================================================

create table if not exists public.rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  rate_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_hits_key_created_idx on public.rate_limit_hits (rate_key, created_at);

alter table public.rate_limit_hits enable row level security;

-- No policies for any role — written only via the service-role client, same lockdown
-- pattern as public.api_cost_log and public.parsed_job_ads in schema.sql.
