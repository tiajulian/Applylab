import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { claimHeldScore } from "@/lib/resume/scoreClaim";
import { SCORE_CLAIM_COOKIE, SCORE_CLAIM_LOGIN_URL } from "@/lib/resume/scoreClaimCookie";

export const dynamic = "force-dynamic";

/**
 * Where the scorer's own signup (email confirmation, Google) and "Log in" link send a visitor who
 * scored a resume before having an account: turns the held score in their score_claim cookie into
 * a resume in their account and opens its report. Without a claimable score it goes to the
 * dashboard. An unknown, used or expired ticket is cleared; a failed claim (database error) keeps
 * it and goes back to the score page, which offers "Try again".
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in yet (or still a guest): keep the cookie and come back here after logging in.
  if (!user || user.is_anonymous) {
    return NextResponse.redirect(`${origin}${SCORE_CLAIM_LOGIN_URL}`);
  }

  const token = (await cookies()).get(SCORE_CLAIM_COOKIE)?.value;
  if (!token) return NextResponse.redirect(`${origin}/dashboard`);

  let resumeId: string | null;
  try {
    resumeId = await claimHeldScore(createServiceRoleClient(), token, user.id);
  } catch (error) {
    console.error("resume-score claim failed", error);
    // Back to the score page (where middleware keeps the ticket), which offers "Try again".
    return NextResponse.redirect(`${origin}/resume-score?claim=failed`);
  }

  const response = NextResponse.redirect(`${origin}${resumeId ? `/resume/${resumeId}/review` : "/dashboard"}`);
  response.cookies.delete(SCORE_CLAIM_COOKIE);
  return response;
}
