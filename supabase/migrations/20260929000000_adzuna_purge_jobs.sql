-- Deletes inactive Adzuna jobs so the table stops growing forever (Supabase free tier is 500 MB;
-- a job row with its embedding is ~8 KB). Jobs any user has saved are kept so the Saved tab never
-- loses them. Deleting cascades to job_matches and the remaining job_interactions rows.
create or replace function public.adzuna_purge_jobs(p_inactive_days integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  delete from public.adzuna_jobs j
   where not j.is_active
     and j.last_seen_at < now() - make_interval(days => p_inactive_days)
     and not exists (
       select 1 from public.job_interactions i where i.job_id = j.id and i.action = 'saved'
     );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.adzuna_purge_jobs(integer) from public, anon, authenticated;
grant execute on function public.adzuna_purge_jobs(integer) to service_role;
