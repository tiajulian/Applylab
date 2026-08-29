-- Migration: Expand resume templates from 2 to 8 ATS-safe templates
-- Allows: clean, classic, modern, compact, editorial, technical, executive, minimal
-- Retains: ats-safe, design-forward for backward compatibility

alter table public.resumes drop constraint if exists resumes_template_check;

alter table public.resumes add constraint resumes_template_check
  check (template in (
    'clean',
    'classic',
    'modern',
    'compact',
    'editorial',
    'technical',
    'executive',
    'minimal',
    'ats-safe',
    'design-forward'
  ));

alter table public.resumes alter column template set default 'clean';

-- Non-destructive data backfill
update public.resumes set template = 'clean' where template = 'ats-safe';
update public.resumes set template = 'modern' where template = 'design-forward';
