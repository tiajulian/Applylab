-- Where an application was added from. 'extension' rows show an "Added by Chrome extension" tag
-- (naming source_site, e.g. "Dayforce") instead of the old "Logged via ApplyLab Co-Pilot on ..."
-- text in notes, which was an internal marker shown to users as if it were their own note.
-- Nullable: rows added in the app have no source.

alter table public.applications
  add column if not exists source text,
  add column if not exists source_site text;

-- Move the legacy marker out of notes.
update public.applications
set source = 'extension',
    source_site = nullif(substring(notes from '^Logged via ApplyLab Co-Pilot on (\S+)$'), 'Other'),
    notes = null
where notes ~ '^Logged via ApplyLab Co-Pilot on \S+$';

-- Repair rows older extension builds saved from ATS apply steps: the employer is the tenant slug
-- in a Dayforce link (jobs.dayforcehcm.com/en-AU/<tenant>/...), and the stored link should be the
-- job ad, not its /apply/... step. Titles like "Manual application" can't be recovered here; the
-- app hides them and asks the user to fill them in.
update public.applications a
set company_name = initcap(replace(t.tenant, '-', ' '))
from (
  select id, substring(job_url from 'dayforcehcm\.com/(?:[A-Za-z]{2}(?:-[A-Za-z]{2})?/)?([^/?#]+)') as tenant
  from public.applications
  where lower(trim(company_name)) in ('company', 'unknown company', 'jobs', 'careers')
    and job_url ~ 'dayforcehcm\.com/'
) t
where a.id = t.id
  and t.tenant is not null
  and t.tenant !~ '^[A-Za-z]{2}(-[A-Za-z]{2})?$';

-- Only Dayforce's trailing apply step (".../jobs/123/apply/manualApplication"); other sites can
-- have "/apply/" mid-path as part of the real link (PageUp), so they're left alone.
update public.applications
set job_url = regexp_replace(job_url, '/apply(/[A-Za-z]+)?/?([?#].*)?$', '', 'i')
where job_url ~* 'dayforcehcm\.com/.*/apply(/[A-Za-z]+)?/?([?#].*)?$';
