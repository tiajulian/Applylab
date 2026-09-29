import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/requireUser";
import { ensureFreshMatches, getMatchesPage, jobsErrorResponse, parseMatchQuery } from "@/lib/jobs/service";

export const dynamic = "force-dynamic";
// Supabase RPCs are POSTs with identical bodies; never let Next replay a cached response.
export const fetchCache = "force-no-store";

export async function GET(request: Request) {
  try {
    const { authUserId } = await requireUser();

    const query = parseMatchQuery(new URL(request.url).searchParams);
    if (!query) return NextResponse.json({ error: "Invalid match query" }, { status: 400 });

    const supabase = createServiceRoleClient();
    if (!(await ensureFreshMatches(supabase, authUserId))) {
      return NextResponse.json({ hasProfile: false, matches: [], total: 0, page: query.page, limit: query.limit });
    }

    const { matches, total } = await getMatchesPage(supabase, authUserId, query);
    return NextResponse.json({ hasProfile: true, matches, total, page: query.page, limit: query.limit });
  } catch (error) {
    return jobsErrorResponse(error, "get-job-matches", "Failed to load job matches");
  }
}
