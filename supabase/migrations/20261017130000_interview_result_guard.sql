-- record_interview_result only answers a round that is still open: scheduled, and either not
-- answered yet or snoozed by "Not sure yet". A second answer from a stale page or another tab is
-- refused instead of overwriting status_before_result with an already-closed status, which would
-- stop Undo from reopening the application.
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
    and i.outcome = 'scheduled'
    and (i.result is null or i.result = 'unsure')
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
