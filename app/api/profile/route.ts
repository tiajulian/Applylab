import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { computeCompleteness, getMissingMvpFields } from "@/lib/profile/completeness";
import type {
  EducationEntry,
  RefereeEntry,
  WorkExperienceEntry,
} from "@/types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

function asRecord(entry: unknown): Record<string, unknown> {
  return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
}

function asExperience(value: unknown): WorkExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      job_title: asString(entry.job_title),
      company: asString(entry.company),
      location: asString(entry.location),
      start_date: asString(entry.start_date),
      end_date: asString(entry.end_date),
      description: asString(entry.description),
    };
  });
}

function asEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      degree: asString(entry.degree),
      institution: asString(entry.institution),
      year: asString(entry.year),
      notes: asString(entry.notes),
    };
  });
}

function asReferees(value: unknown): RefereeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      name: asString(entry.name),
      title: asString(entry.title),
      organisation: asString(entry.organisation),
      phone: asString(entry.phone),
      email: asString(entry.email),
    };
  });
}

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    const body = await request.json();

    const fullName = asString(body.fullName).trim();
    const workRights = asString(body.work_rights);
    const phone = asString(body.phone);
    const location = asString(body.location);
    const linkedinUrl = asString(body.linkedin_url);
    const rawLinkedinPaste = asString(body.raw_linkedin_paste);
    const skills = asStringArray(body.skills);
    const workExperience = asExperience(body.work_experience);
    const education = asEducation(body.education);
    const referees = asReferees(body.referees);
    const completeOnboarding = body.completeOnboarding === true;

    const supabase = createClient();

    const { data: profile, error: upsertError } = await supabase
      .from("user_profiles")
      .upsert(
        {
          user_id: authUserId,
          work_rights: workRights,
          phone,
          location,
          linkedin_url: linkedinUrl,
          skills,
          work_experience: workExperience,
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

    const userUpdate: Record<string, unknown> = { profile_completeness: completeness };
    if (fullName && fullName !== appUser.full_name) {
      userUpdate.full_name = fullName;
    }
    if (completeOnboarding) {
      userUpdate.onboarded = true;
    }

    await supabase.from("users").update(userUpdate).eq("id", authUserId);

    return NextResponse.json({
      profile,
      completeness,
      meetsMvp: missingFields.length === 0,
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
