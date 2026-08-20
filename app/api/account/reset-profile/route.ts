import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

// Uses cookies() (via requireUser) on every request, so it can never be statically rendered.
export const dynamic = "force-dynamic";

/**
 * Resets the CALLING user's own profile back to blank - every user_profiles field, plus cached
 * AI suggestions tied to the profile content just cleared (role duties, skills bridge analyses),
 * which would otherwise reference work experience that no longer exists. Also clears
 * onboarded/profile_completeness on users so the app treats this the same as a fresh profile
 * (see the completeOnboarding gate in app/api/profile/route.ts).
 *
 * Deliberately narrower than /api/account/delete: resumes, cover letters, applications, and the
 * account/billing itself are untouched - this is "start the profile over", not "delete my
 * account" (see AccountDangerZone.tsx for that separate, harder-line flow). Uses the service-role
 * client for the same reason account deletion does: clearing cached AI rows the user's own
 * RLS-scoped session can only read, not bulk-delete by user_id.
 */
export async function POST() {
  try {
    const { authUserId } = await requireUser();
    const serviceClient = createServiceRoleClient();

    const { error: profileError } = await serviceClient
      .from("user_profiles")
      .update({
        work_rights: null,
        phone: null,
        location: null,
        linkedin_url: null,
        work_experience: [],
        education: [],
        skills: [],
        referees: [],
        raw_linkedin_paste: null,
        projects: [],
        tools: [],
        stakeholders: [],
      })
      .eq("user_id", authUserId);

    if (profileError) {
      throw new Error(profileError.message);
    }

    const { error: userError } = await serviceClient
      .from("users")
      .update({ onboarded: false, profile_completeness: 0 })
      .eq("id", authUserId);

    if (userError) {
      throw new Error(userError.message);
    }

    // Cascades to role_duty_items via FK - suggestions/confirmations keyed to job titles from
    // the work experience just cleared above.
    const { error: dutiesError } = await serviceClient
      .from("role_duty_suggestions")
      .delete()
      .eq("user_id", authUserId);
    if (dutiesError) {
      throw new Error(dutiesError.message);
    }

    // Cascades to skills_bridge_items via FK - same reasoning, analyses of profile content that
    // no longer exists.
    const { error: bridgesError } = await serviceClient.from("skills_bridges").delete().eq("user_id", authUserId);
    if (bridgesError) {
      throw new Error(bridgesError.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("reset-profile error", error);
    return NextResponse.json({ error: "Failed to reset profile" }, { status: 500 });
  }
}
