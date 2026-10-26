-- Pre-launch security fixes (audit 2026-10-26).

-- 1. Interview sessions and turns are only ever created by the server (service role). The client
-- INSERT policies came back by accident in 20260828020000_value_first_onboarding.sql, which let a
-- free user insert a session with is_free_allowance = true through /rest/v1 and then use the
-- Pro-only interview routes (and their AI spend) without paying.
drop policy if exists "Users can insert own interview sessions" on public.interview_sessions;
drop policy if exists "Users can insert own interview turns" on public.interview_turns;
revoke insert on public.interview_sessions, public.interview_turns from authenticated, anon;

-- 2. Storage buckets are private. Public buckets skip RLS on reads, so a resume PDF (name, phone,
-- email, history) was readable by anyone holding its URL, forever. Nothing reads resumes.pdf_url
-- and the PDF is returned straight from the export route, so the server no longer stores it.
-- Interview audio is served through short-lived signed URLs (app/api/interview/turns/[turnId]/audio).
update storage.buckets
   set public = false, file_size_limit = 5242880, allowed_mime_types = '{application/pdf}'
 where id = 'resumes';
update storage.buckets
   set public = false, file_size_limit = 5242880, allowed_mime_types = '{audio/mpeg}'
 where id = 'interview-audio';

-- Users could upload any file, any size, into a public bucket. Only the service role writes now.
drop policy if exists "Users can upload own resume PDFs" on storage.objects;
drop policy if exists "Users can update own resume PDFs" on storage.objects;

update public.resumes set pdf_url = null where pdf_url is not null;
