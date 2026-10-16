-- A resume made for a listing from Find jobs remembers that listing's link, so the editor can
-- offer "Apply for this job" (and track the application) without the user hunting for the ad.
-- Nullable: general resumes and resumes from pasted ads have no listing.

alter table public.resumes
  add column if not exists job_url text;
