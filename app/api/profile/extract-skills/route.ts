import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  FreeTierFeatureLimitReachedError,
  requireUser,
  reserveFreeTierFeature,
  UnauthorizedError,
} from "@/lib/requireUser";
import { extractSkillsFromExperience } from "@/lib/profile/extractSkills";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

// Stopgap only (spec §12 step 1): this route spent AI tokens behind nothing but authentication
// before this check existed - a per-feature reserve/gateway port is the real fix, tracked
// separately. Higher than the other stopgaps: triggered interactively while editing a profile
// (per role, not per keystroke), not a one-shot generation action.
const RATE_LIMIT_PER_HOUR = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const supabase = createClient();

  try {
    const { authUserId, appUser } = await requireUser();

    const body = await request.json().catch(() => ({}));
    const experienceText = typeof body.experienceText === "string" ? body.experienceText : "";

    if (!experienceText.trim()) {
      return NextResponse.json({ skills: [] });
    }

    const allowed = await checkAndRecordRateLimit(
      createServiceRoleClient(),
      `extract-skills:${authUserId}`,
      RATE_LIMIT_PER_HOUR,
      RATE_LIMIT_WINDOW_MS
    );
    if (!allowed) {
      return NextResponse.json({ skills: [] });
    }

    // Free-tier account-level cap (spec: "just like resume/assist limitation") - fails soft
    // (empty skills, no error) same as the hourly stopgap above: this is a background autofill
    // helper, not a deliberate "generate" action, so it degrades quietly rather than surfacing an
    // alarming limit-reached error for something the candidate didn't consciously trigger.
    try {
      await reserveFreeTierFeature(supabase, appUser, "extract-skills");
    } catch (reserveError) {
      if (reserveError instanceof FreeTierFeatureLimitReachedError) {
        return NextResponse.json({ skills: [] });
      }
      throw reserveError;
    }

    const skills = await extractSkillsFromExperience(experienceText, authUserId, supabase, appUser.plan);
    return NextResponse.json({ skills });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("extract-skills error", error);
    return NextResponse.json({ error: "Failed to extract skills" }, { status: 500 });
  }
}
