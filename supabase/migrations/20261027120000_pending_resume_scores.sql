-- Keeps a scored resume for a visitor without an account until they sign up or log in.
-- The free scorer (/resume-score) runs before any account exists. Its result is held here for
-- 2 days, and the visitor's browser gets a random claim token in an httpOnly cookie. Only the
-- token's SHA-256 is stored, so a copy of this table can't be used to claim anything. After
-- signup/login, /resume-score/claim calls claim_pending_resume_score with the token's hash, which
-- turns the held score into a resume owned by that user.
--
-- Server-only: RLS on with no policies, no grants to anon/authenticated. Only the service role
-- (the score route and the claim route) reads or writes it.

create table if not exists public.pending_resume_scores (
  id uuid primary key default gen_random_uuid(),
  claim_hash text not null unique,
  job_title text,
  company_name text,
  resume_content jsonb not null,
  review_overall_score integer not null,
  review_categories jsonb not null,
  review_findings jsonb not null default '[]'::jsonb,
  review_content_hash text not null,
  review_scored_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 days'
);

alter table public.pending_resume_scores enable row level security;
revoke all on public.pending_resume_scores from anon, authenticated;

-- Claims in one transaction: the delete...returning means two simultaneous claims of the same
-- token can't both create a resume. Returns the new resume id, or null if the token is unknown,
-- already used, or expired.
create or replace function public.claim_pending_resume_score(p_claim_hash text, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_resume_scores;
  v_resume_id uuid;
begin
  delete from public.pending_resume_scores
   where claim_hash = p_claim_hash
     and expires_at > now()
  returning * into v_pending;

  if v_pending.id is null then
    return null;
  end if;

  insert into public.resumes (
    user_id, job_title, company_name, job_description, resume_content,
    review_overall_score, review_categories, review_findings, review_content_hash, review_scored_at
  ) values (
    p_user_id, v_pending.job_title, v_pending.company_name, '', v_pending.resume_content,
    v_pending.review_overall_score, v_pending.review_categories, v_pending.review_findings,
    v_pending.review_content_hash, v_pending.review_scored_at
  )
  returning id into v_resume_id;

  return v_resume_id;
end;
$$;

revoke execute on function public.claim_pending_resume_score(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_pending_resume_score(text, uuid) to service_role;

create extension if not exists pg_cron;

-- Unclaimed scores hold a resume's personal details, so they don't outlive their 2 days.
select cron.schedule(
  'purge-expired-pending-resume-scores',
  '15 17 * * *', -- 17:15 UTC, just after the guest cleanup
  $$delete from public.pending_resume_scores where expires_at < now()$$
);
