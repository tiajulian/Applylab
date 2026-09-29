import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { embedUserText } from "@/lib/aiGateway/embeddings";
import { getMatchWeights } from "@/lib/jobs/config";
import { refreshUserMatches } from "@/lib/jobs/matching/match";
import { createSupabaseMatchStore } from "@/lib/jobs/matching/store";
import { buildProfileText } from "@/lib/jobs/matching/text";
import { EMPTY_PROFILE, PROFILE_LIMITS, profileFromRow, profileToRow, validateProfileInput } from "@/lib/jobs/profile";
import { getProfileRow, jobsErrorResponse } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
// Supabase RPCs are POSTs with identical bodies; never let Next replay a cached response.
export const fetchCache = "force-no-store";

// Each save that changes the profile text costs one embedding call.
const EMBEDS_PER_HOUR = 20;
const HOUR_MS = 60 * 60 * 1000;

/** The saved profile, or defaults prefilled from the user's main profile (skills, location). */
export async function GET() {
  try {
    const { authUserId } = await requireUser();
    const supabase = createServiceRoleClient();

    const row = await getProfileRow(supabase, authUserId);
    if (row) return NextResponse.json({ profile: profileFromRow(row), exists: true });

    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("skills, location")
      .eq("user_id", authUserId)
      .maybeSingle();
    return NextResponse.json({
      profile: {
        ...EMPTY_PROFILE,
        skills: (userProfile?.skills ?? []).slice(0, PROFILE_LIMITS.skills),
        locations: userProfile?.location ? [userProfile.location] : [],
      },
      exists: false,
    });
  } catch (error) {
    return jobsErrorResponse(error, "get-job-profile", "Failed to load job profile");
  }
}

/** Saves the profile, re-embeds it only if its text changed, and recomputes the user's matches. */
export async function PUT(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    const { input, errors } = validateProfileInput(await request.json().catch(() => null));
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Invalid job profile", fields: errors }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const existing = await getProfileRow(supabase, authUserId);
    const profileText = buildProfileText(input);

    let embedding = existing?.profile_text === profileText ? existing.embedding : null;
    if (!embedding) {
      const allowed = await checkAndRecordRateLimit(supabase, `job-profile-embed:${authUserId}`, EMBEDS_PER_HOUR, HOUR_MS);
      if (!allowed) {
        return NextResponse.json({ error: "Too many profile changes. Try again shortly." }, { status: 429 });
      }
      const vector = await embedUserText(profileText, { supabase: createClient(), userId: authUserId, tier: appUser.plan });
      embedding = `[${vector.join(",")}]`;
    }

    const { data: saved, error } = await supabase
      .from("job_profiles")
      .upsert({ user_id: authUserId, ...profileToRow(input), profile_text: profileText, embedding }, { onConflict: "user_id" })
      .select("updated_at")
      .single();
    if (error) throw error;

    // The profile is saved either way; if this fails, GET /api/job-matches recomputes on demand.
    let matchCount: number | null = null;
    try {
      const matches = await refreshUserMatches(
        { ...input, userId: authUserId, embedding, updatedAt: saved.updated_at },
        createSupabaseMatchStore(supabase),
        getMatchWeights()
      );
      matchCount = matches.length;
    } catch (refreshError) {
      console.error("put-job-profile: match refresh failed", refreshError);
    }

    return NextResponse.json({ profile: input, matchCount });
  } catch (error) {
    return jobsErrorResponse(error, "put-job-profile", "Failed to save job profile");
  }
}
