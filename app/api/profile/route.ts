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
  WorkExperienceWin,
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
const MAX_WINS_PER_ROLE = 10;
// Win Builder tool/stakeholder picks - same accumulate-and-reuse cap shape as skills.
const MAX_TOOLS = 50;
const MAX_STAKEHOLDERS = 50;
// Bounds for a win's structured slots (Win Builder) - short since each is a single tap-picked or
// briefly-typed chip/phrase, not free prose like win.text.
const MAX_WIN_SLOT_LEN = 200;
const MAX_WIN_CHIPS = 10;

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

function asWins(value: unknown): WorkExperienceWin[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_WINS_PER_ROLE)
    .map((raw) => {
      const win = asRecord(raw);
      const win2: WorkExperienceWin = {
        text: asString(win.text, MAX_LONG_LEN),
        metric: asString(win.metric),
      };
      // Win Builder structured slots - optional, additive. Only kept when actually present so a
      // manually-entered legacy win stays a plain { text, metric } row.
      const verb = asString(win.verb, MAX_WIN_SLOT_LEN);
      if (verb) win2.verb = verb;
      const what = asString(win.what, MAX_LONG_LEN);
      if (what) win2.what = what;
      const tools = asStringArray(win.tools, MAX_WIN_CHIPS).map((t) => t.slice(0, MAX_WIN_SLOT_LEN));
      if (tools.length > 0) win2.tools = tools;
      const stakeholders = asStringArray(win.stakeholders, MAX_WIN_CHIPS).map((s) =>
        s.slice(0, MAX_WIN_SLOT_LEN)
      );
      if (stakeholders.length > 0) win2.stakeholders = stakeholders;
      const outcome = asString(win.outcome, MAX_LONG_LEN);
      if (outcome) win2.outcome = outcome;
      return win2;
    })
    .filter((win) => win.text.trim().length > 0);
}

function asExperience(value: unknown): WorkExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    const isCurrent = entry.is_current === true;
    return sanitizeDeep({
      job_title: asString(entry.job_title),
      company: asString(entry.company),
      location: asString(entry.location),
      start_date: asString(entry.start_date),
      end_date: isCurrent ? "" : asString(entry.end_date),
      is_current: isCurrent,
      description: asString(entry.description, MAX_LONG_LEN),
      wins: asWins(entry.wins),
    });
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
        outcome_metric: asString(entry.outcome_metric),
      });
    })
    .filter((entry) => entry.title.trim().length > 0);
}

function asEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LIST_ENTRIES).map((raw) => {
    const entry = asRecord(raw);
    const isCurrent = entry.is_current === true;
    return sanitizeDeep({
      degree: asString(entry.degree),
      institution: asString(entry.institution),
      start_date: asString(entry.start_date),
      end_date: isCurrent ? "" : asString(entry.end_date),
      is_current: isCurrent,
      notes: asString(entry.notes, MAX_LONG_LEN),
    });
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
