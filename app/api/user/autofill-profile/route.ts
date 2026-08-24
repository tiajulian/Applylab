import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { authUserId, appUser } = await requireUser();
    const supabase = createClient();

    // Fetch user profile
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", authUserId)
      .single();

    // Fetch active/latest resume
    const { data: resumes } = await supabase
      .from("resumes")
      .select("id, job_title")
      .eq("user_id", authUserId)
      .order("updated_at", { ascending: false })
      .limit(1);

    const activeResume = resumes && resumes.length > 0 ? resumes[0] : null;

    // Parse full name into first and last name
    const rawName = appUser?.full_name || appUser?.email?.split("@")[0] || "Candidate";
    const nameParts = rawName.trim().split(" ");
    const firstName = nameParts[0] || "Candidate";
    const lastName = nameParts.slice(1).join(" ") || "";

    // Parse location into suburb / state / postcode
    const locationStr = profile?.location || "Sydney NSW 2000";
    const stateMatch = locationStr.match(/\b(NSW|VIC|QLD|WA|SA|TAS|ACT|NT)\b/i);
    const state = (stateMatch ? stateMatch[1].toUpperCase() : "NSW") as any;
    const postcodeMatch = locationStr.match(/\b\d{4}\b/);
    const postcode = postcodeMatch ? postcodeMatch[0] : "2000";
    const suburb = locationStr.replace(state, "").replace(postcode, "").trim() || "Sydney";

    // Work rights status resolution
    const rawWorkRights = (profile?.work_rights || "").toLowerCase();
    let workRightsStatus: any = "AU_CITIZEN";
    let hasUnrestrictedWorkRights = true;
    let requiresSponsorshipNowOrFuture = false;

    if (rawWorkRights.includes("citizen")) {
      workRightsStatus = "AU_CITIZEN";
    } else if (rawWorkRights.includes("permanent") || rawWorkRights.includes("pr")) {
      workRightsStatus = "AU_PERMANENT_RESIDENT";
    } else if (rawWorkRights.includes("482") || rawWorkRights.includes("tss")) {
      workRightsStatus = "VISA_TSS_482";
      hasUnrestrictedWorkRights = true;
      requiresSponsorshipNowOrFuture = true;
    } else if (rawWorkRights.includes("485") || rawWorkRights.includes("graduate")) {
      workRightsStatus = "VISA_GRADUATE_485";
      hasUnrestrictedWorkRights = true;
    } else if (rawWorkRights.includes("sponsorship") || rawWorkRights.includes("require")) {
      workRightsStatus = "NEEDS_SPONSORSHIP";
      hasUnrestrictedWorkRights = false;
      requiresSponsorshipNowOrFuture = true;
    }

    const firstExperience = Array.isArray(profile?.work_experience) && profile.work_experience.length > 0 
      ? profile.work_experience[0] 
      : null;

    const candidateProfile = {
      personal: {
        firstName,
        lastName,
        email: appUser?.email || "",
        phone: profile?.phone || "0400000000",
        streetAddress: "123 Main Street",
        suburb,
        state,
        postcode,
        country: "Australia",
        linkedinUrl: profile?.linkedin_url || "",
      },
      workRights: {
        status: workRightsStatus,
        hasUnrestrictedWorkRights,
        requiresSponsorshipNowOrFuture,
      },
      preferences: {
        noticePeriodWeeks: 4,
        noticePeriodDescription: "4 Weeks",
        expectedSalaryAnnualAUD: 130000,
        hasAustralianDriversLicence: true,
        driversLicenceClass: "C",
        hasWorkingWithChildrenCheck: false,
        willingToUndergoPoliceCheck: true,
      },
      experienceSummary: {
        currentJobTitle: firstExperience?.job_title || "Software Engineer",
        currentCompany: firstExperience?.company || "Tech Company",
        yearsOfExperience: profile?.work_experience?.length ? profile.work_experience.length * 2 : 5,
        skills: profile?.skills || [],
        topAchievements: [],
      },
      activeResumeId: activeResume?.id || "",
      activeResumeName: activeResume?.job_title || "Tailored Resume.pdf",
    };

    return NextResponse.json({ profile: candidateProfile });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("autofill-profile error", error);
    return NextResponse.json({ error: "Failed to fetch candidate profile" }, { status: 500 });
  }
}
