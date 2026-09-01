-- ============================================================================================
-- Cache generated interview-question audio instead of re-calling Cloud Text-to-Speech (or the
-- browser's speechSynthesis fallback) on every "Listen" click. Once a question's audio is
-- synthesized it's stored permanently in Supabase Storage and reused - insulates already-played
-- questions from any future TTS API change/outage, and cuts repeat-listen cost to zero.
-- See app/api/interview/turns/[turnId]/audio/route.ts (generate-or-serve) and
-- lib/googleTts/synthesizeSpeech.ts (Cloud TTS call), components/interview/QuestionCard.tsx
-- (plays the cached URL, falls back to speechSynthesis if generation fails).
-- ============================================================================================

alter table public.interview_turns add column if not exists audio_url text;

-- Public bucket, same convention as the 'resumes' bucket: RLS still scopes access by the
-- first path segment (the owning user's id), but a public bucket also serves the plain
-- storage URL directly without a signed-URL round trip.
insert into storage.buckets (id, name, public)
values ('interview-audio', 'interview-audio', true)
on conflict (id) do nothing;

drop policy if exists "Users can read own interview audio" on storage.objects;
create policy "Users can read own interview audio" on storage.objects
  for select using (bucket_id = 'interview-audio' and (storage.foldername(name))[1] = auth.uid()::text);

-- Deliberately no client-facing insert/update policy - audio is only ever written by the
-- service-role client in app/api/interview/turns/[turnId]/audio/route.ts, same reasoning as
-- interview_turns having no client INSERT policy (schema.sql line ~877).
