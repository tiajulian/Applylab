import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { ingestJobsForTitles } from "@/lib/jobs/ingestion";
import { requireUser } from "@/lib/requireUser";
import { deriveJobProfile } from "@/lib/jobs/autoProfile";
import { EMPTY_PROFILE, profileFromRow, validateProfileInput } from "@/lib/jobs/profile";
import { jobsErrorResponse } from "@/lib/jobs/routeErrors";
import { getProfileRow, persistProfile, ProfileRateLimitError, refreshMatchesFor } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
// Supabase RPCs are POSTs with identical bodies; never let Next replay a cached response.
export const fetchCache = "force-no-store";
// Saving a new job title fetches its jobs from Adzuna and embeds them before matching.
export const maxDuration = 60;

// Each title fetched is one Adzuna call from the budget shared with the nightly run (250 a day by
// default), so cap them per user.
const TITLE_FETCHES_PER_DAY = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const FETCH_TIME_BUDGET_MS = 30_000;

/** Titles in `next` that `previous` didn't have (case-insensitive). */
function newTitles(previous: string[], next: string[]): string[] {
  const known = new Set(previous.map((t) => t.toLowerCase()));
  return next.filter((t) => !known.has(t.toLowerCase()));
}

/** The saved profile, or a preview of the automatic one built from the user's own data. */
export async function GET() {
  try {
    const { authUserId } = await requireUser();
    const supabase = createServiceRoleClient();

    const row = await getProfileRow(supabase, authUserId);
    if (row) return NextResponse.json({ profile: profileFromRow(row), exists: true, isAuto: row.is_auto });

    const derived = await deriveJobProfile(supabase, authUserId);
    return NextResponse.json({ profile: derived ?? EMPTY_PROFILE, exists: false, isAuto: true });
  } catch (error) {
    return jobsErrorResponse(error, "get-job-profile", "Failed to load job profile");
  }
}

/**
 * Saves the profile and recomputes matches. A customised profile stops following the user's own
 * data; `automatic: true` (QuickStart's starter titles) keeps following it, so it is replaced by
 * the automatic profile once the user has a profile, resumes or applications to build from.
 */
export async function PUT(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    const body = await request.json().catch(() => null);
    const { input, errors } = validateProfileInput(body);
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Invalid job profile", fields: errors }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const user = { id: authUserId, tier: appUser.plan };
    const automatic = (body as { automatic?: unknown } | null)?.automatic === true;
    const existing = await getProfileRow(supabase, authUserId);
    const row = await persistProfile(supabase, user, input, automatic, existing);

    // The pool is filled nightly from broad queries, so a newly searched role may have no jobs in
    // it yet: fetch them now. Best effort - the nightly run also picks up profile titles.
    const titles: string[] = [];
    for (const title of newTitles(existing?.target_titles ?? [], input.targetTitles)) {
      if (!(await checkAndRecordRateLimit(supabase, `job-fetch:${authUserId}`, TITLE_FETCHES_PER_DAY, DAY_MS))) break;
      titles.push(title);
    }
    if (titles.length) {
      const started = Date.now();
      try {
        await ingestJobsForTitles(titles, () => Date.now() - started < FETCH_TIME_BUDGET_MS);
      } catch (fetchError) {
        console.error("put-job-profile: on-demand job fetch failed", fetchError);
      }
    }

    // The profile is saved either way; if this fails, GET /api/job-matches recomputes on demand.
    let matchCount: number | null = null;
    try {
      matchCount = (await refreshMatchesFor(supabase, authUserId, { ...row, embedding: row.embedding! })).length;
    } catch (refreshError) {
      console.error("put-job-profile: match refresh failed", refreshError);
    }

    return NextResponse.json({ profile: input, matchCount });
  } catch (error) {
    if (error instanceof ProfileRateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    return jobsErrorResponse(error, "put-job-profile", "Failed to save job profile");
  }
}

/** Drops the customised profile; the next match request rebuilds the automatic one. */
export async function DELETE() {
  try {
    const { authUserId } = await requireUser();
    const { error } = await createServiceRoleClient().from("job_profiles").delete().eq("user_id", authUserId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jobsErrorResponse(error, "delete-job-profile", "Failed to reset job profile");
  }
}
