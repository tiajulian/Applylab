-- Interview practice v2, release 1: settings on the setup page do what they say.
-- Additive only: every new column is nullable or has a default.

alter table public.interview_sessions
  add column if not exists pressure_level text not null default 'realistic',
  add column if not exists question_count_target int,
  add column if not exists used_fallback_questions boolean not null default false;

alter table public.interview_sessions drop constraint if exists interview_sessions_pressure_level_check;
alter table public.interview_sessions add constraint interview_sessions_pressure_level_check
  check (pressure_level in ('supportive', 'realistic', 'tough'));

-- Client-generated per answer so a retried submit whose first response was lost returns the
-- stored result instead of a 409 (see app/api/interview/sessions/[id]/turns/route.ts).
alter table public.interview_turns
  add column if not exists submission_id uuid;

-- Existing column grants are unchanged: authenticated users can still only update
-- interview_sessions.status and nothing on interview_turns. These columns are server-written.

-- Set when a submit starts scoring a turn, so a retry that arrives mid-score waits for the first
-- request instead of paying for a second scoring call. Stale after the route's maxDuration.
alter table public.interview_turns
  add column if not exists scoring_started_at timestamptz;
