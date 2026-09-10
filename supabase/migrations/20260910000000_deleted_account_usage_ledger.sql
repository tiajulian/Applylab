-- ============================================================================================
-- Closes the "delete account, sign up again, free tier resets" loophole: resumes_used and
-- free_tier_feature_usage (20260907020000_free_tier_feature_limits.sql) both cascade-delete with
-- the user row (public.users.id references auth.users.id on delete cascade), so a fresh signup
-- with a new auth user always starts at zero, even if it's the same person.
--
-- This adds a small ledger keyed by a normalized email, populated right before an account is
-- deleted and consulted on every signup, so a deleted account's usage carries over to a new
-- signup under the same (or a Gmail/Outlook-style +tag variant of the same) email instead of
-- resetting. Doesn't stop someone using a genuinely different email address - that's a
-- different, harder problem (see free-tier-ai-limiting-spec) - just closes the free "delete and
-- retry" path.
-- ============================================================================================

-- Strips a Gmail/Outlook-style "+tag" from the local part and lowercases/trims, so
-- "Foo+2@Gmail.com" and "foo@gmail.com" normalize to the same key. Only ever used to key the
-- ledger below, never to change what's stored in users.email or sent to.
create or replace function public.normalize_identity_email(p_email text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(p_email)), '\+[^@]*(@)', '\1');
$$;

create table if not exists public.deleted_account_usage_ledger (
  normalized_email text primary key,
  resumes_used int not null default 0,
  feature_usage jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.deleted_account_usage_ledger enable row level security;
-- No policies for any role, including the account's own owner - there's no "owner" once the
-- account is deleted, and the only legitimate access pattern is the SECURITY DEFINER functions
-- below (archive on delete, lookup inside handle_new_user on signup). Same lockdown pattern as
-- public.api_cost_log.

-- Snapshots a soon-to-be-deleted account's usage into the ledger, merging with (not overwriting)
-- any prior snapshot for the same normalized email via greatest() - usage only ever grows within
-- an account's life, so the higher of "what the ledger already had" and "what this account has
-- now" is always the correct carry-forward value, even across repeated delete/resignup cycles.
-- Must be called BEFORE auth.admin.deleteUser() cascades the row away.
create or replace function public.archive_account_usage_before_delete(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_normalized text;
  v_resumes_used int;
  v_feature_usage jsonb;
begin
  select email, resumes_used into v_email, v_resumes_used
  from public.users
  where id = p_user_id;

  if v_email is null then
    return;
  end if;

  v_normalized := public.normalize_identity_email(v_email);

  select coalesce(jsonb_object_agg(feature, count), '{}'::jsonb)
  into v_feature_usage
  from public.free_tier_feature_usage
  where user_id = p_user_id;

  insert into public.deleted_account_usage_ledger (normalized_email, resumes_used, feature_usage, updated_at)
  values (v_normalized, v_resumes_used, v_feature_usage, now())
  on conflict (normalized_email) do update
  set resumes_used = greatest(deleted_account_usage_ledger.resumes_used, excluded.resumes_used),
      feature_usage = (
        select coalesce(jsonb_object_agg(
          k,
          greatest(
            coalesce((deleted_account_usage_ledger.feature_usage ->> k)::int, 0),
            coalesce((excluded.feature_usage ->> k)::int, 0)
          )
        ), '{}'::jsonb)
        from (
          select jsonb_object_keys(deleted_account_usage_ledger.feature_usage) as k
          union
          select jsonb_object_keys(excluded.feature_usage) as k
        ) all_keys
      ),
      updated_at = now();
end;
$$;

-- service_role only, called from app/api/account/delete/route.ts right before deleteUser(). Must
-- never be reachable by `authenticated` - it takes an arbitrary p_user_id with no auth.uid()
-- check (there's no "self" to check against once we're archiving on the way out), so granting
-- this to authenticated would let any signed-in user archive (and thus read the shape of) any
-- other user's usage.
grant execute on function public.archive_account_usage_before_delete(uuid) to service_role;

-- Re-seed a fresh signup from any prior ledger snapshot for the same normalized email, so
-- resumes_used and free_tier_feature_usage start where the deleted account left off instead of
-- at zero.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized text;
  v_ledger public.deleted_account_usage_ledger;
  v_feature text;
  v_count text;
begin
  v_normalized := public.normalize_identity_email(new.email);

  select * into v_ledger
  from public.deleted_account_usage_ledger
  where normalized_email = v_normalized;

  insert into public.users (id, email, full_name, accepted_terms_at, accepted_terms_version, resumes_used)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when new.raw_user_meta_data ->> 'accepted_terms_version' is not null then now() else null end,
    new.raw_user_meta_data ->> 'accepted_terms_version',
    coalesce(v_ledger.resumes_used, 0)
  )
  on conflict (id) do nothing;

  if v_ledger.normalized_email is not null then
    for v_feature, v_count in select key, value from jsonb_each_text(v_ledger.feature_usage)
    loop
      insert into public.free_tier_feature_usage (user_id, feature, count)
      values (new.id, v_feature, v_count::int)
      on conflict (user_id, feature) do update set count = excluded.count;
    end loop;
  end if;

  return new;
end;
$$;
