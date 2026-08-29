-- One-time micro-unlocks for individual resumes ($2.99 clean export unlock)
create table if not exists public.resume_unlocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  resume_id uuid not null references public.resumes (id) on delete cascade,
  stripe_session_id text,
  amount_aud int not null default 299,
  unlocked_at timestamptz not null default now(),
  constraint resume_unlocks_user_resume_unique unique (user_id, resume_id)
);

create index if not exists resume_unlocks_user_id_idx on public.resume_unlocks (user_id);
create index if not exists resume_unlocks_resume_id_idx on public.resume_unlocks (resume_id);

alter table public.resume_unlocks enable row level security;

create policy "Users can view own resume unlocks" on public.resume_unlocks
  for select using (auth.uid() = user_id);
