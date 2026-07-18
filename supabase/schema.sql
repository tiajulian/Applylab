-- applylab database schema, run once in the Supabase SQL editor.

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'lifetime')),
  stripe_customer_id text,
  resumes_used int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  work_rights text,
  phone text,
  location text,
  linkedin_url text,
  work_experience jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  skills text[] not null default '{}',
  referees jsonb not null default '[]'::jsonb,
  raw_linkedin_paste text,
  updated_at timestamptz not null default now()
);

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  job_description text not null,
  job_title text,
  company_name text,
  resume_content jsonb,
  cover_letter_content text,
  ats_score int,
  missing_keywords text[] not null default '{}',
  pdf_url text,
  template text not null default 'ats-safe' check (template in ('ats-safe', 'design-forward')),
  created_at timestamptz not null default now()
);

create index if not exists resumes_user_id_idx on public.resumes (user_id);

-- Keep public.users in sync with auth.users on signup.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: every table is scoped to the owning user.
alter table public.users enable row level security;
alter table public.user_profiles enable row level security;
alter table public.resumes enable row level security;

create policy "Users can view own row" on public.users
  for select using (auth.uid() = id);

create policy "Users can update own row" on public.users
  for update using (auth.uid() = id);

create policy "Users can view own profile" on public.user_profiles
  for select using (auth.uid() = user_id);

create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = user_id);

create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = user_id);

create policy "Users can view own resumes" on public.resumes
  for select using (auth.uid() = user_id);

create policy "Users can insert own resumes" on public.resumes
  for insert with check (auth.uid() = user_id);

create policy "Users can update own resumes" on public.resumes
  for update using (auth.uid() = user_id);

create policy "Users can delete own resumes" on public.resumes
  for delete using (auth.uid() = user_id);

-- Storage bucket for generated resume PDFs.
insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', true)
on conflict (id) do nothing;

create policy "Users can read own resume PDFs" on storage.objects
  for select using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can upload own resume PDFs" on storage.objects
  for insert with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users can update own resume PDFs" on storage.objects
  for update using (bucket_id = 'resumes' and (storage.foldername(name))[1] = auth.uid()::text);
