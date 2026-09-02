-- 0-4 short, distinctive facts about the role/team/company (e.g. "first hire for a new team",
-- "follow-the-sun on-call with an overseas team") that must_have_skills/key_responsibilities
-- don't capture - lets interview-question-gen (and any future consumer) reference genuinely
-- specific detail without re-sending the full raw ad text on every call. See
-- lib/anthropic/parseJobAd.ts for the extraction prompt. Empty array is a normal, expected
-- result for an ad with nothing distinctive beyond a standard skills/responsibilities list -
-- never backfilled for rows parsed before this migration ran, same as every other field here.
alter table public.parsed_job_ads add column if not exists notable_context text[] not null default '{}';
