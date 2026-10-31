alter table public.user_profiles
  add column if not exists portfolio_url text,
  add column if not exists github_url text;
