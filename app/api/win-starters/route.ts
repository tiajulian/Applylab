import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  FreeTierFeatureLimitReachedError,
  requireUser,
  reserveFreeTierFeature,
  UnauthorizedError,
} from "@/lib/requireUser";
import { extractWinStarters } from "@/lib/anthropic/winStarters";

// Uses cookies() (via requireUser) on every request, so it can never be statically rendered.
export const dynamic = "force-dynamic";

// Called at most once per role per Win Builder session (see lib/wins/starterLadder.ts - never on
// keystroke or load), so this only needs a light backstop against a user repeatedly reopening the
// builder to force fresh calls.
const RATE_LIMIT_PER_HOUR = 20;
const MAX_DESCRIPTION_LEN = 5000;

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { authUserId, appUser } = await requireUser();
    const body = await request.json();
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!description) {
      return NextResponse.json({ starters: [] });
    }

    const serviceRoleSupabase = createServiceRoleClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await serviceRoleSupabase
      .from("api_cost_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", "win-starters")
      .gte("created_at", oneHourAgo);

    // Rate limit fails soft: the starter ladder just falls through to its next rung rather than
    // surfacing an error for what is only a personalisation nicety.
    if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
      return NextResponse.json({ starters: [] });
    }

    // Free-tier account-level cap (spec: "just like resume/assist limitation") - fails soft
    // (empty starters, no error) same as the hourly stopgap above: a personalisation nicety, not
    // a deliberate "generate" action worth an alarming limit-reached error.
    try {
      await reserveFreeTierFeature(supabase, appUser, "win-starters");
    } catch (reserveError) {
      if (reserveError instanceof FreeTierFeatureLimitReachedError) {
        return NextResponse.json({ starters: [] });
      }
      throw reserveError;
    }

    const starters = await extractWinStarters(
      description.slice(0, MAX_DESCRIPTION_LEN),
      authUserId,
      supabase,
      appUser.plan
    );
    return NextResponse.json({ starters });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("win-starters error", error);
    return NextResponse.json({ starters: [] });
  }
}
