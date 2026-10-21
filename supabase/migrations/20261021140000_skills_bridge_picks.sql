-- The candidate's own tool/people picks for a skill gap item (tapped when they say yes or claim a
-- gap), and the analysis's likely suggestions to tap from (empty when they don't fit). Updates go
-- through the item PATCH route (service role, cleaned and capped), so the update grant is
-- unchanged. Picks on a matched item never come from the app, so confirmedBridgeItems ignores them.
alter table public.skills_bridge_items add column if not exists tools text[] not null default '{}';
alter table public.skills_bridge_items add column if not exists stakeholders text[] not null default '{}';
alter table public.skills_bridge_items add column if not exists suggested_tools text[] not null default '{}';
alter table public.skills_bridge_items add column if not exists suggested_stakeholders text[] not null default '{}';
