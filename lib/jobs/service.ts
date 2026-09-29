import type { SupabaseClient } from "@supabase/supabase-js";
import { embedUserText } from "@/lib/aiGateway/embeddings";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { createClient } from "@/lib/supabase/server";
import { deriveJobProfile } from "@/lib/jobs/autoProfile";
import { getMatchWeights } from "@/lib/jobs/config";
import { refreshUserMatches, type RankedMatch } from "@/lib/jobs/matching/match";
import { toPercent } from "@/lib/jobs/matching/score";
import { createSupabaseMatchStore } from "@/lib/jobs/matching/store";
import { buildProfileText } from "@/lib/jobs/matching/text";
import { PROFILE_COLUMNS, profileFromRow, profileToRow, type JobProfileInput, type JobProfileRow } from "@/lib/jobs/profile";
import { toJobDto, type JobFields, type MatchPageQuery } from "@/lib/jobs/api";
import type { Plan } from "@/types";

// Each save that changes the embedded profile text costs one embedding call.
const EMBEDS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

export class ProfileRateLimitError extends Error {}

export interface JobUser {
  id: string;
  tier: Plan;
}

export async function getProfileRow(supabase: SupabaseClient, userId: string): Promise<JobProfileRow | null> {
  const { data, error } = await supabase.from("job_profiles").select(PROFILE_COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as JobProfileRow | null;
}

/**
 * Saves a profile, re-embedding (metered to the user, rate-limited) only when the embedded text
 * changed. Throws ProfileRateLimitError when a re-embed is needed but over the hourly limit.
 *
 * An automatic save (isAuto) is guarded: it only writes if the row is exactly as it was read
 * (`existing`), so a slow background rebuild can never overwrite a profile the user customised
 * in the meantime - it returns whatever is stored now instead. A user's own save always wins.
 */
export async function persistProfile(
  supabase: SupabaseClient,
  user: JobUser,
  input: JobProfileInput,
  isAuto: boolean,
  existing: JobProfileRow | null
): Promise<JobProfileRow> {
  const profileText = buildProfileText(input);
  let embedding = existing?.profile_text === profileText ? existing.embedding : null;
  if (!embedding) {
    if (!(await checkAndRecordRateLimit(supabase, `job-profile-embed:${user.id}`, EMBEDS_PER_HOUR, HOUR_MS))) {
      throw new ProfileRateLimitError("Too many profile changes. Try again shortly.");
    }
    const vector = await embedUserText(profileText, { supabase: createClient(), userId: user.id, tier: user.tier });
    embedding = `[${vector.join(",")}]`;
  }

  const values = { user_id: user.id, ...profileToRow(input), profile_text: profileText, embedding, is_auto: isAuto };
  const table = supabase.from("job_profiles");
  const write = !isAuto
    ? table.upsert(values, { onConflict: "user_id" })
    : existing
      ? table.update(values).eq("user_id", user.id).eq("is_auto", true).eq("updated_at", existing.updated_at)
      : table.upsert(values, { onConflict: "user_id", ignoreDuplicates: true });
  const { data, error } = await write.select(PROFILE_COLUMNS).maybeSingle();
  if (error) throw error;
  // A guarded automatic write that matched nothing lost a race; serve what's stored now.
  return (data as JobProfileRow | null) ?? (await getProfileRow(supabase, user.id))!;
}

/**
 * The user's job profile, creating or refreshing the automatic one from their existing data
 * (see lib/jobs/autoProfile.ts) unless they have customised it. Null when there is nothing to
 * match on yet. An automatic profile whose source data hasn't changed is returned as-is, with no
 * write and no embedding call.
 */
export async function ensureJobProfile(supabase: SupabaseClient, user: JobUser): Promise<JobProfileRow | null> {
  const existing = await getProfileRow(supabase, user.id);
  if (existing && !existing.is_auto) return existing;

  const derived = await deriveJobProfile(supabase, user.id);
  if (!derived || (existing && buildProfileText(derived) === existing.profile_text)) return existing;
  try {
    return await persistProfile(supabase, user, derived, true, existing);
  } catch (error) {
    // Rate limit, AI outage, timeout: keep serving the last good profile; the next request retries.
    if (!existing) throw error;
    if (!(error instanceof ProfileRateLimitError)) console.error("ensureJobProfile: rebuild failed, serving previous profile", error);
    return existing;
  }
}

/** Recomputes and caches the user's matches from a stored profile row. */
export function refreshMatchesFor(supabase: SupabaseClient, userId: string, row: JobProfileRow & { embedding: string }): Promise<RankedMatch[]> {
  return refreshUserMatches(
    { ...profileFromRow(row), userId, embedding: row.embedding, updatedAt: row.updated_at },
    createSupabaseMatchStore(supabase),
    getMatchWeights()
  );
}

/**
 * Recomputes the match cache unless it was computed after the profile's last save and after the
 * latest successful ingestion started (a run refreshes matches only after saving all its jobs, so
 * a cache computed by that run counts as fresh). All timestamps come from the database clock, and
 * matches_computed_at is set even when there are zero matches.
 */
export async function ensureFreshMatches(
  supabase: SupabaseClient,
  userId: string,
  row: JobProfileRow & { embedding: string }
): Promise<void> {
  const { data: lastRun, error } = await supabase
    .from("adzuna_ingest_runs")
    .select("started_at")
    .eq("status", "succeeded")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;

  const computedAt = row.matches_computed_at;
  const ingestedAt = lastRun?.started_at as string | undefined;
  const fresh =
    computedAt !== null &&
    Date.parse(computedAt) >= Date.parse(row.updated_at) &&
    (!ingestedAt || Date.parse(computedAt) >= Date.parse(ingestedAt));
  if (!fresh) await refreshMatchesFor(supabase, userId, row);
}

/** What the Matches page shows in its "Matching you for" bar. */
export function profileSummary(row: JobProfileRow) {
  return { targetTitles: row.target_titles, locations: row.locations, skillCount: row.skills.length, isAuto: row.is_auto };
}

interface MatchPageRow extends Omit<JobFields, "id"> {
  job_id: string;
  score: number;
  reasons: string[];
  saved: boolean;
  total: number;
}

async function fetchMatchRows(supabase: SupabaseClient, userId: string, query: MatchPageQuery, limit: number, offset: number) {
  const { data, error } = await supabase.rpc("job_matches_page", {
    p_user_id: userId,
    p_limit: limit,
    p_offset: offset,
    p_sort: query.sort,
    p_location: query.location,
    p_min_salary: query.minSalary,
    p_contract_types: query.contractTypes,
    p_max_age_days: query.maxAgeDays,
  });
  if (error) throw error;
  return (data ?? []) as MatchPageRow[];
}

export async function getMatchesPage(supabase: SupabaseClient, userId: string, query: MatchPageQuery) {
  const rows = await fetchMatchRows(supabase, userId, query, query.limit, (query.page - 1) * query.limit);
  // Every row carries the filtered total, but a page past the end has no rows to carry it (e.g.
  // after dismissing jobs while on the last page), so ask for the first row instead.
  const total = rows[0]?.total ?? (query.page > 1 ? (await fetchMatchRows(supabase, userId, query, 1, 0))[0]?.total ?? 0 : 0);
  return {
    total,
    matches: rows.map((row) => ({
      job: toJobDto({ ...row, id: row.job_id }),
      score: toPercent(row.score),
      reasons: row.reasons,
      saved: row.saved,
    })),
  };
}
