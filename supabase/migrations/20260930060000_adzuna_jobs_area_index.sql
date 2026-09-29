-- Lets the automatic job profile resolve a suburb (e.g. "Kogarah") to its city by finding a job
-- whose Adzuna location_area contains it, without scanning the whole table.
create index if not exists adzuna_jobs_location_area_idx on public.adzuna_jobs using gin (location_area);
