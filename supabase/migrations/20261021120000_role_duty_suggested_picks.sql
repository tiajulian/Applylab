-- Likely tools and people/teams for each suggested duty, from suggestRoleDuties, offered in
-- SuggestTasksBuilder.tsx as tap-to-add picks (empty when they don't fit the task). Suggestions
-- only: what the candidate actually taps is saved to tools/stakeholders. Left out of the update
-- grant like duty_text/category; the server cleans and caps them on insert.
alter table public.role_duty_items add column if not exists suggested_tools text[] not null default '{}';
alter table public.role_duty_items add column if not exists suggested_stakeholders text[] not null default '{}';
