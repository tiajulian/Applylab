-- "Just the job ad" practice: no resume, only a pasted job ad, grounded in the Career Profile like
-- a tailored resume is. The flag tells it apart from an uploaded-resume session whose resume was
-- deleted (both have no resume left), which can't be scored any more.
alter table public.interview_sessions add column if not exists job_ad_only boolean not null default false;

alter table public.interview_sessions drop constraint if exists interview_sessions_job_ad_only_check;
alter table public.interview_sessions add constraint interview_sessions_job_ad_only_check
  check (not job_ad_only or (resume_id is null and uploaded_resume_id is null and job_description is not null));
