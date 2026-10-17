-- How an interview round went, as told to the home dashboard's "How did your ... go?" check-in.
--   result               'well' | 'unsure' | 'no' (null = not asked or not answered yet)
--   result_recorded_at   when it was answered; 'well' schedules the follow-up reminder from here
--   ask_again_at         'unsure' snoozes the check-in until this time (the round stays scheduled)
--   status_before_result the application's status before answering, so Undo restores it exactly
--                        (needed for 'no', which closes the application)

alter table public.application_interviews
  add column if not exists result text check (result in ('well', 'unsure', 'no')),
  add column if not exists result_recorded_at timestamptz,
  add column if not exists ask_again_at timestamptz,
  add column if not exists status_before_result text;

-- Records an answer in one transaction: the round, and for 'no' the application too. SECURITY
-- INVOKER, so the existing application_interviews/applications RLS policies decide ownership.
create or replace function public.record_interview_result(
  p_application_id uuid,
  p_interview_id uuid,
  p_result text,
  p_recheck_days integer
)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_application_id uuid;
  v_status text;
begin
  if p_result not in ('well', 'unsure', 'no') then
    raise exception 'invalid result %', p_result;
  end if;

  select i.application_id, a.status
    into v_application_id, v_status
  from public.application_interviews i
  join public.applications a on a.id = i.application_id
  where i.id = p_interview_id
    and i.application_id = p_application_id
  for update of i, a;

  if v_application_id is null then
    return false;
  end if;

  update public.application_interviews
  set result = p_result,
      result_recorded_at = now(),
      outcome = case when p_result = 'unsure' then outcome else 'completed' end,
      ask_again_at = case when p_result = 'unsure' then now() + make_interval(days => p_recheck_days) else null end,
      status_before_result = v_status,
      updated_at = now()
  where id = p_interview_id;

  if p_result = 'no' then
    update public.applications
    set status = 'rejected', updated_at = now()
    where id = v_application_id;
  end if;

  return true;
end;
$$;

-- Undoes record_interview_result: the round is scheduled and unanswered again, and an application
-- closed by 'no' goes back to the status it had before (unless it has been moved on since).
create or replace function public.undo_interview_result(p_application_id uuid, p_interview_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_application_id uuid;
  v_result text;
  v_status_before text;
begin
  select application_id, result, status_before_result
    into v_application_id, v_result, v_status_before
  from public.application_interviews
  where id = p_interview_id
    and application_id = p_application_id
  for update;

  if v_application_id is null or v_result is null then
    return false;
  end if;

  update public.application_interviews
  set result = null,
      result_recorded_at = null,
      ask_again_at = null,
      status_before_result = null,
      outcome = 'scheduled',
      updated_at = now()
  where id = p_interview_id;

  if v_result = 'no' and v_status_before is not null then
    update public.applications
    set status = v_status_before, updated_at = now()
    where id = v_application_id
      and status = 'rejected';
  end if;

  return true;
end;
$$;

revoke all on function public.record_interview_result(uuid, uuid, text, integer) from public, anon;
revoke all on function public.undo_interview_result(uuid, uuid) from public, anon;
grant execute on function public.record_interview_result(uuid, uuid, text, integer) to authenticated;
grant execute on function public.undo_interview_result(uuid, uuid) to authenticated;
