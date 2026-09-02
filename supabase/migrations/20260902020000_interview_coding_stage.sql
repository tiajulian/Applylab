-- Migration: Add 'coding' as an interview stage_type
-- Coding-round mock interviews reuse the existing session/turn pipeline, scored by an LLM reading
-- the submitted code (mode 'coaching', no STAR rubric - see lib/interview/mode.ts).

alter table public.interview_sessions drop constraint if exists interview_sessions_stage_type_check;

alter table public.interview_sessions add constraint interview_sessions_stage_type_check
  check (stage_type in ('phone_screen', 'technical', 'panel', 'async_video', 'group', 'general', 'coding'));

alter table public.application_interviews drop constraint if exists application_interviews_stage_type_check;

alter table public.application_interviews add constraint application_interviews_stage_type_check
  check (stage_type in ('phone_screen', 'technical', 'panel', 'async_video', 'group', 'general', 'coding'));
