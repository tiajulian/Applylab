-- Migration: Add technical_assessment column to interview_turns
-- For coding and technical interview questions, evaluations produce structured technical assessment
-- (correctness, strengths, improvements, coaching advice, coach note, time assessment) rather than
-- spoken STAR metrics.

alter table public.interview_turns
  add column if not exists technical_assessment jsonb;
