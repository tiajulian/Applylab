import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { computeCompleteness, getMissingMvpFields } from "@/lib/profile/completeness";
import {
  MAX_LINKEDIN_PASTE_LEN,
  MAX_STAKEHOLDERS,
  MAX_TOOLS,
  asEducation,
  asExperience,
  asProjects,
  asReferees,
  asString,
  asStringArray,
} from "@/lib/profile/sanitizeProfileEntries";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    const body = await request.json();

    const careerGoal = asString(body.career_goal);
    const targetRole = asString(body.target_role);
    const jobHuntPain = asString(body.job_hunt_pain);
    const fullName = asString(body.fullName).trim();
    const workRights = asString(body.work_rights);
    const phone = asString(body.phone);
    const location = asString(body.location);
    const linkedinUrl = asString(body.linkedin_url);
    const rawLinkedinPaste = asString(body.raw_linkedin_paste, MAX_LINKEDIN_PASTE_LEN);
    const skills = asStringArray(body.skills);
    const tools = asStringArray(body.tools, MAX_TOOLS);
    const stakeholders = asStringArray(body.stakeholders, MAX_STAKEHOLDERS);
    const workExperience = asExperience(body.work_experience);
    const projects = asProjects(body.projects);
    const education = asEducation(body.education);
    const referees = asReferees(body.referees);
    const completeOnboarding = body.completeOnboarding === true;

    const supabase = createClient();

    const { data: profile, error: upsertError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: authUserId,
          career_goal: careerGoal || null,
          target_role: targetRole || null,
          job_hunt_pain: jobHuntPain || null,
          work_rights: workRights,
          phone,
          location,
          linkedin_url: linkedinUrl,
          skills,
          tools,
          stakeholders,
          work_experience: workExperience,
          projects,
          education,
          referees,
          raw_linkedin_paste: rawLinkedinPaste,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    const effectiveFullName = fullName || appUser.full_name || "";
    const completeness = computeCompleteness({
      fullName: effectiveFullName,
      work_rights: workRights,
      phone,
      location,
      linkedin_url: linkedinUrl,
      raw_linkedin_paste: rawLinkedinPaste,
      skills,
      work_experience: workExperience,
      education,
      referees,
    });
    const missingFields = getMissingMvpFields({
      fullName: effectiveFullName,
      work_rights: workRights,
      phone,
      location,
      linkedin_url: linkedinUrl,
      raw_linkedin_paste: rawLinkedinPaste,
      skills,
      work_experience: workExperience,
      education,
      referees,
    });
    const meetsMvp = missingFields.length === 0;

    const userUpdate: Record<string, unknown> = { profile_completeness: completeness };
    if (fullName && fullName !== appUser.full_name) {
      userUpdate.full_name = fullName;
    }
    // Onboarding can only actually complete once the profile clears the MVP bar — trusting
    // the client's completeOnboarding flag alone would let anyone mark themselves onboarded
    // with an empty profile and permanently skip the guided wizard.
    if (completeOnboarding && meetsMvp) {
      userUpdate.onboarded = true;
    }

    await supabase.from("users").update(userUpdate).eq("id", authUserId);

    return NextResponse.json({
      profile,
      completeness,
      meetsMvp,
      missingFields,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("save-profile error", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
