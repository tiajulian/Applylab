import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import {
  FREE_RESUME_LIMIT,
  FreeLimitReachedError,
  markFreeAllowanceResume,
  refundResumeGeneration,
  requirePermanentUser,
  reserveResumeGeneration,
  UnauthorizedError,
  unauthorizedResponse,
} from "@/lib/requireUser";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import { GENERAL_RESUME_TITLE } from "@/lib/resume/generalResume";
import { canonicalTemplate } from "@/lib/resume/templateMetadata";
import type { ResumeContent } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered.
export const dynamic = "force-dynamic";

/**
 * "Start from scratch": an empty resume the user fills in themselves in the editor. No AI runs, but
 * it still takes one of the plan's resumes, so a free user's blank resume is theirs to download like
 * any other. Only the contact block is prefilled, from the account and the saved profile.
 */
export async function POST() {
  const supabase = createClient();
  let reservedForUserId: string | null = null;

  try {
    const { authUserId, appUser } = await requirePermanentUser();

    const rateLimited = await enforceRateLimit(`create-resume:${authUserId}`, 20, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("phone, location, linkedin_url, work_rights")
      .eq("user_id", authUserId)
      .maybeSingle();

    const content: ResumeContent = {
      contact: {
        name: appUser.full_name ?? "",
        email: appUser.email ?? "",
        phone: profile?.phone ?? "",
        location: profile?.location ?? "",
        linkedin: profile?.linkedin_url ?? "",
        work_rights: profile?.work_rights ?? "",
      },
      target_titles: [],
      summary: "",
      skills: [],
      tools: [],
      experience: [],
      projects: [],
      education: [],
      referees: [],
    };

    await reserveResumeGeneration(supabase, appUser);
    reservedForUserId = authUserId;

    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: authUserId,
        job_description: "",
        job_title: GENERAL_RESUME_TITLE,
        resume_content: content,
        template: canonicalTemplate(undefined),
      })
      .select("id")
      .single();

    if (insertError) {
      await refundResumeGeneration(authUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // The row exists and its slot is spent: from here nothing refunds or fails the request, or a
    // "Try again" would make a second blank resume.
    reservedForUserId = null;
    try {
      await markFreeAllowanceResume(appUser, resume.id);
      await saveVersionSnapshot(supabase, resume.id, content, "Blank resume");
    } catch (followUpError) {
      console.error("create-resume: follow-up after insert failed", followUpError);
    }

    return NextResponse.json({ resume });
  } catch (error) {
    if (reservedForUserId) {
      await refundResumeGeneration(reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
    }
    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    if (error instanceof FreeLimitReachedError) {
      return NextResponse.json(
        { error: "Free resume limit reached", code: "FREE_LIMIT_REACHED", limit: FREE_RESUME_LIMIT },
        { status: 403 }
      );
    }
    console.error("create-resume error", error);
    return NextResponse.json({ error: "Failed to create resume" }, { status: 500 });
  }
}
