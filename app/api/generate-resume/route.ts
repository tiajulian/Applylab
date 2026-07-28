import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateResume } from "@/lib/anthropic/generateResume";
import { assertWithinFreeLimit, FreeLimitReachedError, requireUser, UnauthorizedError } from "@/lib/requireUser";
import { getMissingMvpFields } from "@/lib/profile/completeness";
import type { UserProfile } from "@/types";

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertWithinFreeLimit(appUser);

    const { jobDescription, jobTitle, companyName } = await request.json();

    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .maybeSingle();

    const profileData = profile as UserProfile | null;

    const missingFields = getMissingMvpFields({
      fullName: appUser.full_name ?? "",
      work_rights: profileData?.work_rights ?? null,
      phone: profileData?.phone ?? null,
      location: profileData?.location ?? null,
      linkedin_url: profileData?.linkedin_url ?? null,
      raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
      skills: profileData?.skills ?? [],
      work_experience: profileData?.work_experience ?? [],
      education: profileData?.education ?? [],
      referees: profileData?.referees ?? [],
    });

    if (missingFields.length > 0) {
      return NextResponse.json(
        { error: "Profile incomplete", missingFields },
        { status: 422 }
      );
    }

    const resumeContent = await generateResume({
      jobDescription,
      jobTitle: jobTitle ?? "",
      companyName: companyName ?? "",
      fullName: appUser.full_name ?? "",
      email: appUser.email,
      profile: {
        work_rights: profileData?.work_rights ?? null,
        phone: profileData?.phone ?? null,
        location: profileData?.location ?? null,
        linkedin_url: profileData?.linkedin_url ?? null,
        work_experience: profileData?.work_experience ?? [],
        education: profileData?.education ?? [],
        skills: profileData?.skills ?? [],
        referees: profileData?.referees ?? [],
        raw_linkedin_paste: profileData?.raw_linkedin_paste ?? null,
      },
    });

    const { data: resume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: authUserId,
        job_description: jobDescription,
        job_title: jobTitle ?? null,
        company_name: companyName ?? null,
        resume_content: resumeContent,
        template: "ats-safe",
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await supabase
      .from("users")
      .update({ resumes_used: appUser.resumes_used + 1 })
      .eq("id", authUserId);

    return NextResponse.json({ resume });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof FreeLimitReachedError) {
      return NextResponse.json({ error: "Free resume limit reached" }, { status: 403 });
    }
    console.error("generate-resume error", error);
    return NextResponse.json({ error: "Failed to generate resume" }, { status: 500 });
  }
}
