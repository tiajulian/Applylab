import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { parseMatchQuery } from "@/lib/jobs/api";
import { jobsErrorResponse } from "@/lib/jobs/routeErrors";
import { ensureFreshMatches, ensureJobProfile, getMatchesPage, profileSummary } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
// Supabase RPCs are POSTs with identical bodies; never let Next replay a cached response.
export const fetchCache = "force-no-store";

/** Ranked matches. No setup needed: the profile is built from the user's own data on first use. */
export async function GET(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    const query = parseMatchQuery(new URL(request.url).searchParams);
    if (!query) return NextResponse.json({ error: "Invalid match query" }, { status: 400 });

    const supabase = createServiceRoleClient();
    const row = await ensureJobProfile(supabase, { id: authUserId, tier: appUser.plan });
    if (!row?.embedding) {
      return NextResponse.json({ hasProfile: false, profile: null, matches: [], total: 0, page: query.page, limit: query.limit });
    }

    await ensureFreshMatches(supabase, authUserId, { ...row, embedding: row.embedding });
    const { matches, total } = await getMatchesPage(supabase, authUserId, query);
    return NextResponse.json({ hasProfile: true, profile: profileSummary(row), matches, total, page: query.page, limit: query.limit });
  } catch (error) {
    return jobsErrorResponse(error, "get-job-matches", "Failed to load job matches");
  }
}
