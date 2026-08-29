-- AI Resume Review (5-category meta score, findings, and paywall cache)
alter table public.resumes add column if not exists review_overall_score int;
alter table public.resumes add column if not exists review_categories jsonb;
alter table public.resumes add column if not exists review_findings jsonb not null default '[]';
alter table public.resumes add column if not exists review_content_hash text;
alter table public.resumes add column if not exists review_scored_at timestamptz;
