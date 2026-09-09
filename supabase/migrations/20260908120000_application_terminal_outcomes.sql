-- Migration: Add 'accepted' and 'withdrawn' as application terminal outcomes
-- Unifies the Applications tracker's status vocabulary with the dashboard pipeline's stage
-- vocabulary (see components/applications/ApplicationsBoard.tsx COLUMNS and
-- lib/dashboard/pipeline.ts PipelineCounts). 'screening' is intentionally NOT added here - it
-- stays a view-layer derivation over interviewing applications + application_interviews.stage_type
-- (see computePipelineCountsFromData), not a stored status, since making it one would conflict
-- with that existing auto-derivation and there's no product decision yet on how the two would
-- interact.

alter table public.applications drop constraint if exists applications_status_check;

alter table public.applications add constraint applications_status_check
  check (status in ('applied', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn'));
