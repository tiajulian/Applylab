import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { computeCompleteness, getMissingMvpFields } from "@/lib/profile/completeness";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import type {
  EducationEntry,
  ProjectEntry,
  RefereeEntry,
  WorkExperienceEntry,
} from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Bounds on stored profile data — this all gets re-embedded into the resume-generation
// prompt on every future generation, so unbounded fields/arrays would let a single save
// inflate Anthropic cost indefinitely.
const MAX_SHORT_LEN = 500;
const MAX_LONG_LEN = 5000;
const MAX_LINKEDIN_PASTE_LEN = 50_000;
const MAX_LIST_ENTRIES = 30;
const MAX_SKILLS = 50;

function asString(value: unknown, maxLength: number = MAX_SHORT_LEN): string {
  const str = typeof value === "string" ? value : "";
  return str.slice(0, maxLength);
}

function asStringArray(value: unknown, maxEntries: number = MAX_SKILLS): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .slice(0, maxEntries)
    .map((v) => v.slice(0, MAX_SHORT_LEN));
}

function asRecord(entry: unknown): Record<string, unknown> {
  return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
}

function asExperience(value: unknown): WorkExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    return {
      job_title: asString(entry.job_title),
      company: asString(entry.company),
      location: asString(entry.location),
      start_date: asString(entry.start_date),
      end_date: asString(entry.end_date),
      description: asString(entry.description, MAX_LONG_LEN),
      achievement: asString(entry.achievement, MAX_LONG_LEN),
    };
  });
}

function asProjects(value: unknown): ProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_LIST_ENTRIES)
    .map((raw) => {
      const entry = asRecord(raw);
      return sanitizeDeep({
        title: asString(entry.title),
        description: asString(entry.description, MAX_LONG_LEN),
        context: asString(entry.context),
        timeframe: asString(entry.timeframe),
        tools: asStringArray(entry.tools),
        link: asString(entry.link),
        outcome: asString(entry.outcome, MAX_LONG_LEN),
      });
    })
    .filter((entry) => entry.title.trim().length > 0);
}

function asEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    return {
      degree: asString(entry.degree),
      institution: asString(entry.institution),
      year: asString(entry.year),
      notes: asString(entry.notes, MAX_LONG_LEN),
    };
  });
}

function asReferees(value: unknown): RefereeEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
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
    const rawLinkedinPaste = asString(body.raw_linkedin_paste, MAX_LINKEDIN_PASTE_LEN);
    const skills = asStringArray(body.skills);
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
          work_rights: workRights,
          phone,
          location,
          linkedin_url: linkedinUrl,
          skills,
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
