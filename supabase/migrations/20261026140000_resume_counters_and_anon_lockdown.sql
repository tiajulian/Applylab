-- Security hardening (audit 2026-10-26, follow-up to 20261026130000_prelaunch_security_fixes.sql).

-- 1. Resume usage counters can't be seeded by a direct insert. Users may insert their own resumes
-- through /rest/v1 (generate-resume and duplicate insert with the user's client), and the insert
-- grant covers assist_calls_used/content_score_count, so a row inserted with -10000 got ~10000
-- free AI assists. The existing trigger already forced is_free_allowance off for user inserts;
-- it now zeroes the counters too, and the counters can never go negative.
create or replace function public.resumes_force_free_allowance_off()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_free_allowance := false;
    new.assist_calls_used := 0;
    new.content_score_count := 0;
  end if;
  return new;
end;
$$;

-- None were negative on 2026-10-26, but clamp first so the constraints can't fail to apply.
update public.resumes
   set assist_calls_used = greatest(assist_calls_used, 0),
       content_score_count = greatest(content_score_count, 0)
 where assist_calls_used < 0 or content_score_count < 0;

alter table public.resumes
  add constraint resumes_assist_calls_used_nonneg check (assist_calls_used >= 0),
  add constraint resumes_content_score_count_nonneg check (content_score_count >= 0);

-- 2. Defence in depth. Signed-out visitors (anon) never write any table - guest sessions use the
-- authenticated role, and every signed-out server write uses the service role - so RLS should not
-- be the only thing stopping them. resume_unlocks is written only by the Stripe webhook.
revoke insert, update, delete on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke insert, update, delete on tables from anon;
revoke insert, update, delete on public.resume_unlocks from authenticated;

-- These check auth.uid() themselves, so a signed-out caller could do nothing with them, but they
-- have no reason to be reachable without a session. authenticated keeps its own explicit grant.
revoke execute on function
  public.accept_terms(text),
  public.increment_assist_calls(uuid, integer),
  public.increment_content_score_count(uuid, integer),
  public.increment_free_tier_feature_usage(uuid, text, integer),
  public.increment_resumes_used(uuid, integer),
  public.reserve_ai_credits(uuid, text, text, text, text, integer, timestamptz, integer)
from anon, public;
