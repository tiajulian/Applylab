-- Interview practice v2, release 2: the practice loop (skip, end early, retries, separate report).
-- Additive only: every new column is nullable or has a default.

alter table public.interview_sessions
  add column if not exists ended_reason text,
  add column if not exists report_status text not null default 'pending',
  add column if not exists report_started_at timestamptz;

alter table public.interview_sessions drop constraint if exists interview_sessions_ended_reason_check;
alter table public.interview_sessions add constraint interview_sessions_ended_reason_check
  check (ended_reason in ('completed', 'ended_early', 'abandoned'));

alter table public.interview_sessions drop constraint if exists interview_sessions_report_status_check;
alter table public.interview_sessions add constraint interview_sessions_report_status_check
  check (report_status in ('pending', 'building', 'ready', 'failed'));

-- Sessions finished before this release already carry their report.
update public.interview_sessions set report_status = 'ready' where report is not null and report_status = 'pending';

create index if not exists interview_sessions_user_created_idx on public.interview_sessions (user_id, created_at desc);

alter table public.interview_turns
  add column if not exists skipped boolean not null default false,
  add column if not exists score_reasons jsonb,
  add column if not exists biggest_fix text,
  add column if not exists what_worked jsonb,
  add column if not exists transcript_spans jsonb,
  add column if not exists suggested_answer_sources jsonb,
  add column if not exists attempt_count int not null default 1;

-- "Try again" answers. The turn keeps attempt 1; each retry is a row here. Columns mirror
-- interview_turns so feedback and the report read both the same way.
create table if not exists public.interview_turn_attempts (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references public.interview_turns (id) on delete cascade,
  session_id uuid not null references public.interview_sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  attempt_number int not null check (attempt_number between 2 and 3),
  transcript text,
  answer_source text check (answer_source in ('voice', 'text')),
  duration_sec numeric,
  wpm numeric,
  filler_count int,
  star_scores jsonb,
  score_reasons jsonb,
  biggest_fix text,
  what_worked jsonb,
  transcript_spans jsonb,
  content_feedback text,
  delivery_feedback text,
  suggested_answer text,
  suggested_answer_sources jsonb,
  submission_id uuid,
  created_at timestamptz not null default now(),
  unique (turn_id, attempt_number)
);

create index if not exists interview_turn_attempts_session_idx on public.interview_turn_attempts (session_id);

alter table public.interview_turn_attempts enable row level security;

drop policy if exists "Users can view own interview attempts" on public.interview_turn_attempts;
create policy "Users can view own interview attempts" on public.interview_turn_attempts
  for select using (auth.uid() = user_id);

drop policy if exists "Users can delete own interview attempts" on public.interview_turn_attempts;
create policy "Users can delete own interview attempts" on public.interview_turn_attempts
  for delete using (auth.uid() = user_id);

-- No insert/update policy: attempts are scored and written only by the server (service role).
revoke insert, update on public.interview_turn_attempts from authenticated;
