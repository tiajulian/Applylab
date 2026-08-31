-- Performance indexes for frequent lookups and sorted feeds
-- Fix 2: Foreign key lookup on applications by resume_id
create index if not exists applications_resume_id_idx on public.applications (resume_id);

-- Fix 3: Composite indexes for user-scoped sorted lists
create index if not exists resumes_user_created_idx on public.resumes (user_id, created_at desc);
create index if not exists applications_user_created_idx on public.applications (user_id, created_at desc);
create index if not exists applications_user_applied_idx on public.applications (user_id, applied_date desc);

-- Fix 4: Index for closing date range queries on parsed job ads
create index if not exists parsed_job_ads_closes_at_idx
  on public.parsed_job_ads (closes_at)
  where closes_at is not null;
