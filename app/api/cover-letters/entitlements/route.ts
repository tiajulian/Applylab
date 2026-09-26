import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { COVER_LETTER_LIMITS, THIN_RESUME } from "@/lib/coverLetter/config";
import { canCreateLetter, lockedFeatures, remainingLetters } from "@/lib/coverLetter/entitlements";
import { featureDisabledResponse, isThinResume } from "@/lib/coverLetter/server";
import { targetJobTitle } from "@/lib/resume/generalResume";
import { cleanPrefill } from "@/lib/coverLetter/validation";
import type { Resume } from "@/types";

export const dynamic = "force-dynamic";

/**
 * Drives the front-end gating (advisory only, the create/patch routes enforce) and gives the setup modal
 * its resume list with job details already cleaned of `[Job Title]`-style placeholders.
 */
export async function GET() {
  const disabled = featureDisabledResponse();
  if (disabled) return disabled;

  try {
    const { authUserId, appUser } = await requireUser();
    const supabase = createClient();

    const [{ count }, { data: resumes }] = await Promise.all([
      supabase
        .from("cover_letters")
        .select("id", { count: "exact", head: true })
        .eq("user_id", authUserId)
        .is("deleted_at", null),
      supabase
        .from("resumes")
        .select("id, job_title, company_name, job_description, resume_content, created_at")
        .eq("user_id", authUserId)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const activeLetters = count ?? 0;
    return NextResponse.json({
      plan: appUser.plan,
      canCreate: canCreateLetter(appUser.plan, activeLetters),
      remainingLetters: remainingLetters(appUser.plan, activeLetters),
      lockedFeatures: lockedFeatures(appUser.plan),
      resumes: ((resumes ?? []) as Resume[]).map((resume) => {
        const content = resume.resume_content ? sanitizeResumeContent(resume.resume_content) : null;
        return {
          id: resume.id,
          jobTitle: cleanPrefill(targetJobTitle(resume.job_title)),
          company: cleanPrefill(resume.company_name),
          jobDescription: (resume.job_description ?? "").slice(0, COVER_LETTER_LIMITS.jobDescriptionMax),
          hasContent: Boolean(content),
          isThin: isThinResume(content, THIN_RESUME.minSkills),
        };
      }),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    console.error("cover letter entitlements error", error);
    return NextResponse.json({ error: "Failed to load cover letter settings" }, { status: 500 });
  }
}
