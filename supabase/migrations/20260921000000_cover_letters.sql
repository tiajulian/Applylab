-- Standalone cover letters (feature flag cover_letter_v1). Separate from resumes.cover_letter_content,
-- which the resume workspace still uses. Existing per-resume letters are NOT copied in.
--
-- Writes that must be entitlement-checked (INSERT) go through the API with the service role; the
-- authenticated role can only read its own rows and update the user-editable columns, so the free-tier
-- letter cap cannot be bypassed by calling Supabase directly from the browser.

create table if not exists public.cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  resume_id uuid references public.resumes (id) on delete set null,
  title text not null,
  job_title text not null default '',
  company text not null default '',
  hiring_manager text not null default '',
  job_description text not null default '',
  content jsonb not null default '{}'::jsonb,
  language text not null default 'English',
  tone text not null default 'professional',
  length text not null default 'standard',
  created_via text not null check (created_via in ('ai', 'blank')),
  status text not null default 'draft' check (status in ('draft', 'downloaded')),
  word_count integer not null default 0,
  -- Client-generated per create request: a retry or double-click returns the existing row instead of a duplicate.
  idempotency_key text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists cover_letters_user_idempotency_idx
  on public.cover_letters (user_id, idempotency_key) where idempotency_key is not null;
create index if not exists cover_letters_user_active_idx
  on public.cover_letters (user_id, updated_at desc) where deleted_at is null;
create index if not exists cover_letters_resume_id_idx on public.cover_letters (resume_id);

alter table public.cover_letters enable row level security;

create policy "Users can view own cover letters" on public.cover_letters
  for select using (auth.uid() = user_id);

create policy "Users can update own cover letters" on public.cover_letters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke insert, update, delete on public.cover_letters from authenticated;
grant update (title, hiring_manager, content, word_count, deleted_at, updated_at) on public.cover_letters to authenticated;
