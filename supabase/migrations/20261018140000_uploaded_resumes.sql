-- "Upload my resume": practice interviews from a resume not made in ApplyLab. The resume is
-- uploaded (PDF/Word) or pasted, read once into the Career Profile shape, and saved for reuse.
-- Only the extracted text is kept, never the file. Additive only.

create table if not exists public.uploaded_resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  source text not null check (source in ('pdf', 'docx', 'paste')),
  raw_text text not null,
  -- ParsedProfileFields (lib/anthropic/parseProfile.ts): what questions, hints and the honesty
  -- check read instead of the Career Profile.
  parsed jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists uploaded_resumes_user_created_idx on public.uploaded_resumes (user_id, created_at desc);

alter table public.uploaded_resumes enable row level security;

drop policy if exists "Users can view own uploaded resumes" on public.uploaded_resumes;
create policy "Users can view own uploaded resumes" on public.uploaded_resumes
  for select using (auth.uid() = user_id);

drop policy if exists "Users can update own uploaded resumes" on public.uploaded_resumes;
create policy "Users can update own uploaded resumes" on public.uploaded_resumes
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own uploaded resumes" on public.uploaded_resumes;
create policy "Users can delete own uploaded resumes" on public.uploaded_resumes
  for delete using (auth.uid() = user_id);

-- No client INSERT policy: rows are only written by app/api/interview/uploaded-resumes, which
-- reads the text itself, so `parsed` always matches `raw_text`. Clients may only rename.
revoke update on public.uploaded_resumes from authenticated;
grant update (name) on public.uploaded_resumes to authenticated;

-- A session practises from a tailored resume or an uploaded one. Uploaded sessions keep their
-- own copy of the job, and deleting the uploaded resume keeps the session (and its report).
alter table public.interview_sessions alter column resume_id drop not null;

alter table public.interview_sessions
  add column if not exists uploaded_resume_id uuid references public.uploaded_resumes (id) on delete set null,
  add column if not exists job_title text,
  add column if not exists company_name text,
  add column if not exists job_description text;

create index if not exists interview_sessions_uploaded_resume_idx on public.interview_sessions (uploaded_resume_id);

alter table public.interview_sessions drop constraint if exists interview_sessions_resume_source_check;
alter table public.interview_sessions add constraint interview_sessions_resume_source_check
  check ((resume_id is null or uploaded_resume_id is null) and (resume_id is not null or job_description is not null));
