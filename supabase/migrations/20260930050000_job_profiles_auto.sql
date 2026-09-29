-- Job profiles are now built automatically from the user's existing data (profile skills and
-- location, work history, and the job titles of resumes and applications). is_auto = true means
-- the profile still follows that data and is re-derived when it changes; saving the "Adjust"
-- form sets it to false. Deleting the row returns the user to the automatic profile.
alter table public.job_profiles add column if not exists is_auto boolean not null default false;
