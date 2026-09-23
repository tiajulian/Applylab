-- Migration: Design & Font panel per-resume overrides (lib/resume/designPrefs.ts)
-- Five new nullable columns on public.resumes, each layered on top of the chosen template's own
-- defaults, never replacing them. null/unset means "use the template's own default", so every
-- existing resume keeps rendering exactly as it did before this migration.
--
-- The literal values in each check constraint must stay in sync with lib/resume/designPrefs.ts's
-- FONT_CHOICES/ACCENT_SWATCHES/preset lists by hand - a SQL check constraint can't reference a TS
-- constant.

alter table public.resumes add column if not exists accent_color text
  check (accent_color is null or accent_color in ('#1e3a8a', '#14532d', '#831843', '#334155'));

alter table public.resumes add column if not exists font_choice text
  check (font_choice is null or font_choice in ('arial', 'calibri', 'georgia', 'times_new_roman', 'garamond', 'verdana'));

alter table public.resumes add column if not exists margin_preset text
  check (margin_preset is null or margin_preset in ('compact', 'standard', 'spacious'));

alter table public.resumes add column if not exists spacing_preset text
  check (spacing_preset is null or spacing_preset in ('compact', 'standard', 'spacious'));

alter table public.resumes add column if not exists line_height_preset text
  check (line_height_preset is null or line_height_preset in ('compact', 'standard', 'relaxed'));

-- revoke update on public.resumes from authenticated already applies (see supabase/schema.sql) -
-- without a matching column-level grant, the app role cannot write these columns at all.
grant update (accent_color, font_choice, margin_preset, spacing_preset, line_height_preset) on public.resumes to authenticated;
