-- Security fix: usage refunds and AI-credit commits were callable by the signed-in user through
-- /rest/v1/rpc, so anyone could undo their own usage (decrement_*), refund an in-flight AI
-- reservation, or commit it at 0 credits - resetting free-tier limits at will. They are now
-- service-role only; the server passes the already-verified user id, so the auth.uid() checks
-- (which can't work under the service role) are replaced by explicit user scoping.
-- The increment_* / reserve_ai_credits functions stay user-callable: calling them can only use up
-- the caller's own allowance.

create or replace function public.decrement_resumes_used(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users
     set resumes_used = greatest(resumes_used - 1, 0)
   where id = p_user_id;
end;
$$;

drop function if exists public.decrement_assist_calls(uuid);
create or replace function public.decrement_assist_calls(p_resume_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resumes
     set assist_calls_used = greatest(assist_calls_used - 1, 0)
   where id = p_resume_id
     and user_id = p_user_id;
end;
$$;

drop function if exists public.decrement_content_score_count(uuid);
create or replace function public.decrement_content_score_count(p_resume_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.resumes
     set content_score_count = greatest(content_score_count - 1, 0)
   where id = p_resume_id
     and user_id = p_user_id;
end;
$$;

create or replace function public.decrement_free_tier_feature_usage(p_user_id uuid, p_feature text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.free_tier_feature_usage
     set count = greatest(count - 1, 0),
         updated_at = now()
   where user_id = p_user_id
     and feature = p_feature;
end;
$$;

create or replace function public.commit_ai_credits(
  p_ledger_id uuid,
  p_user_id uuid,
  p_credits_actual integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cache_creation_input_tokens integer,
  p_cache_read_input_tokens integer,
  p_cost_usd numeric
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.ai_usage_ledger
     set status = 'committed',
         credits_actual = p_credits_actual,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens,
         cache_creation_input_tokens = p_cache_creation_input_tokens,
         cache_read_input_tokens = p_cache_read_input_tokens,
         cost_usd = p_cost_usd,
         committed_at = now()
   where id = p_ledger_id
     and user_id = p_user_id
     and status = 'reserved';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

create or replace function public.refund_ai_credits(p_ledger_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  update public.ai_usage_ledger
     set status = 'refunded'
   where id = p_ledger_id
     and user_id = p_user_id
     and status = 'reserved';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.decrement_resumes_used(uuid) from public, anon, authenticated;
revoke all on function public.decrement_assist_calls(uuid, uuid) from public, anon, authenticated;
revoke all on function public.decrement_content_score_count(uuid, uuid) from public, anon, authenticated;
revoke all on function public.decrement_free_tier_feature_usage(uuid, text) from public, anon, authenticated;
revoke all on function public.commit_ai_credits(uuid, uuid, integer, integer, integer, integer, integer, numeric) from public, anon, authenticated;
revoke all on function public.refund_ai_credits(uuid, uuid) from public, anon, authenticated;

grant execute on function public.decrement_resumes_used(uuid) to service_role;
grant execute on function public.decrement_assist_calls(uuid, uuid) to service_role;
grant execute on function public.decrement_content_score_count(uuid, uuid) to service_role;
grant execute on function public.decrement_free_tier_feature_usage(uuid, text) to service_role;
grant execute on function public.commit_ai_credits(uuid, uuid, integer, integer, integer, integer, integer, numeric) to service_role;
grant execute on function public.refund_ai_credits(uuid, uuid) to service_role;
