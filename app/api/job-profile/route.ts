import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { deriveJobProfile } from "@/lib/jobs/autoProfile";
import { EMPTY_PROFILE, profileFromRow, validateProfileInput } from "@/lib/jobs/profile";
import { jobsErrorResponse } from "@/lib/jobs/routeErrors";
import { getProfileRow, persistProfile, ProfileRateLimitError, refreshMatchesFor } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
// Supabase RPCs are POSTs with identical bodies; never let Next replay a cached response.
export const fetchCache = "force-no-store";

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
    const row = await persistProfile(supabase, user, input, automatic, await getProfileRow(supabase, authUserId));

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
