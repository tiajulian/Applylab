import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateCoverLetter } from "@/lib/anthropic/generateCoverLetter";
import {
  FreeTierFeatureLimitReachedError,
  freeTierLimitReachedResponse,
  requireUser,
  reserveFreeTierFeature,
  trackFreeTierReservation,
  UnauthorizedError,
} from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import type { Resume } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Stopgap only (spec §12 step 1): this route spent AI tokens behind nothing but authentication
// before this check existed - a per-feature reserve/gateway port is the real fix, tracked
// separately.
const RATE_LIMIT_PER_HOUR = 15;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

export async function POST(request: Request) {
  const supabase = createClient();
  const reservation = trackFreeTierReservation("cover-letter");

  try {
    const { authUserId, appUser } = await requireUser();

    const { resumeId } = await request.json();

    if (!resumeId || typeof resumeId !== "string") {
      return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
    }

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;

    if (!resumeRow.resume_content) {
      return NextResponse.json(
        { error: "Resume must be generated before creating a cover letter" },
        { status: 400 }
      );
    }

    const allowed = await checkAndRecordRateLimit(
      createServiceRoleClient(),
      `cover-letter:${authUserId}`,
      RATE_LIMIT_PER_HOUR,
      RATE_LIMIT_WINDOW_MS
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Cover letter limit reached for now. Try again shortly." },
        { status: 429 }
      );
    }

    // Free-tier account-level cap (spec: "just like resume/assist limitation") - separate from
    // the hourly stopgap above, which only bounds a burst, not repeated use over days.
    await reserveFreeTierFeature(supabase, appUser, "cover-letter");
    reservation.markReserved(authUserId);

    const compactJobAd = await getOrParseCompactJobAd(resumeRow.job_description, authUserId, supabase, appUser.plan);

    const coverLetter = await generateCoverLetter({
      compactJobAd,
      jobTitle: resumeRow.job_title ?? "",
      companyName: resumeRow.company_name ?? "",
      resumeContent: sanitizeResumeContent(resumeRow.resume_content),
    }, authUserId, supabase, appUser.plan);

    const { error: updateError } = await supabase
      .from("resumes")
      .update({ cover_letter_content: coverLetter })
      .eq("id", resumeId);

    if (updateError) {
      await reservation.refundIfReserved(supabase);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ coverLetter });
  } catch (error) {
    await reservation.refundIfReserved(supabase);

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof FreeTierFeatureLimitReachedError) {
      return freeTierLimitReachedResponse(error);
    }
    console.error("generate-cover-letter error", error);
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 });
  }
}
