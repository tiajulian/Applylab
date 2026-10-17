-- Interview practice v2, release 3: history, progress, links to applications, question-type
-- marking, story hints, the free practice and mic consent. Additive only.

alter table public.interview_sessions
  add column if not exists application_id uuid references public.applications (id) on delete set null,
  add column if not exists application_interview_id uuid references public.application_interviews (id) on delete set null,
  add column if not exists is_free_allowance boolean not null default false,
  add column if not exists story_hints boolean not null default true;

create index if not exists interview_sessions_application_interview_idx on public.interview_sessions (application_interview_id);
create index if not exists interview_sessions_application_idx on public.interview_sessions (application_id);

-- rubric: how the question is marked (star | motivation | gap | technical | coding).
-- rubric_scores: 1-5 per part for the motivation and gap rubrics (STAR keeps star_scores).
-- suggested_evidence: profile stories that could fit this question (story hints).
alter table public.interview_turns
  add column if not exists rubric text,
  add column if not exists rubric_scores jsonb,
  add column if not exists suggested_evidence jsonb;

alter table public.interview_turn_attempts
  add column if not exists rubric_scores jsonb;

-- Server-written only: the authenticated column update grant on public.users is unchanged, so a
-- client can neither fake consent nor reset its free practice by deleting the session.
alter table public.users
  add column if not exists mic_consent_at timestamptz,
  add column if not exists free_interviews_used int not null default 0;

-- "Practise result-heavy questions": the part the session leans towards, so "Try tailoring again"
-- keeps the same focus.
alter table public.interview_sessions add column if not exists focus_part text;
alter table public.interview_sessions drop constraint if exists interview_sessions_focus_part_check;
alter table public.interview_sessions add constraint interview_sessions_focus_part_check
  check (focus_part in ('situation', 'task', 'action', 'result'));
