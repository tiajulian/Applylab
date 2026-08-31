-- ============================================================================================
-- User feedback inbox: lets a signed-in user (including anonymous trial accounts) submit a bug
-- report, feature request, complaint, or general note. Private inbox only for now (no public
-- voting board) - submissions are visible to the submitter and to admins, and only admins can
-- change status. See app/api/feedback/route.ts (submit/list-own) and
-- app/api/admin/feedback/* (admin triage), and components/feedback/FeedbackModal.tsx (UI).
-- ============================================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  type text not null check (type in ('bug', 'feature', 'complaint', 'other')),
  message text not null,
  -- Which page the user was on when they submitted, for context during triage (e.g. a bug
  -- report from /resume/[id] vs a feature request from /dashboard). Client-supplied, best-effort.
  page_url text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'planned', 'done', 'declined')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists feedback_status_idx on public.feedback (status);

alter table public.feedback enable row level security;

create policy "Users can view own feedback" on public.feedback
  for select using (auth.uid() = user_id);

create policy "Users can insert own feedback" on public.feedback
  for insert with check (auth.uid() = user_id);

-- Deliberately no update/delete policy for `authenticated` - a submission is immutable once
-- sent, and `status` is triaged by admins only. Admin routes use the service-role client
-- (bypasses RLS) to read every user's feedback and update status.
