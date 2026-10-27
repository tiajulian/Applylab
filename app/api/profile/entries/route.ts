import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { computeCompleteness, toScorableProfile } from "@/lib/profile/completeness";
import { profileEntryKey, type ProfileEntrySection } from "@/lib/resume/addEntries";
import {
  MAX_LIST_ENTRIES,
  asEducation,
  asExperience,
  asProjects,
  asReferees,
} from "@/lib/profile/sanitizeProfileEntries";

export const dynamic = "force-dynamic";

// Each section's own sanitizer (the same one the full profile save uses) and the field it can't
// be saved without - an entry missing it is what "+ Add role" used to leave behind, not a real one.
const SECTIONS: Record<ProfileEntrySection, { sanitize: (value: unknown) => unknown[]; required: string }> = {
  work_experience: { sanitize: asExperience, required: "job_title" },
  projects: { sanitize: asProjects, required: "title" },
  education: { sanitize: asEducation, required: "degree" },
  referees: { sanitize: asReferees, required: "name" },
};

// Read-append-write, so two saves close together (two quick "Save and add another"s, or the
// profile page saving in another tab) could each write back a list missing the other's entry. The
// write only lands if the row is unchanged since it was read; otherwise it re-reads and tries again.
const MAX_ATTEMPTS = 3;

/**
 * Appends one entry to a profile list (work_experience, projects, education or referees). Used by
 * the resume editor's Add pop-up when "Also save to my profile" is ticked, so a role added there is
 * on the next resume too - without the editor having to post (and risk overwriting) the whole profile.
 */
export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    const body = await request.json().catch(() => ({}));
    const section = body?.section as ProfileEntrySection;
    const spec = Object.prototype.hasOwnProperty.call(SECTIONS, section) ? SECTIONS[section] : null;
    if (!spec) {
      return NextResponse.json({ error: "Unknown profile section." }, { status: 400 });
    }

    const [entry] = spec.sanitize([body.entry]) as Record<string, unknown>[];
    if (!entry || typeof entry[spec.required] !== "string" || !(entry[spec.required] as string).trim()) {
      return NextResponse.json({ error: "This entry is missing its title." }, { status: 400 });
    }
    const key = profileEntryKey(section, entry);

    const supabase = createClient();
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data: profile, error: readError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (readError) {
        return NextResponse.json({ error: "Couldn't read your profile." }, { status: 500 });
      }
      // Nothing to add to yet: the profile itself is created by the profile page's own save, which
      // needs fields this endpoint never sees. The resume still has the entry.
      if (!profile) {
        return NextResponse.json({ saved: false, reason: "no_profile" });
      }

      const current = Array.isArray(profile[section]) ? (profile[section] as Record<string, unknown>[]) : [];
      if (current.some((existing) => profileEntryKey(section, existing) === key)) {
        return NextResponse.json({ saved: true, alreadySaved: true });
      }
      if (current.length >= MAX_LIST_ENTRIES) {
        return NextResponse.json({ saved: false, reason: "full" });
      }

      const next = [...current, entry];
      const update = supabase
        .from("user_profiles")
        .update({ [section]: next, updated_at: new Date().toISOString() })
        .eq("user_id", authUserId);
      const { data: written, error: updateError } = await (profile.updated_at
        ? update.eq("updated_at", profile.updated_at)
        : update.is("updated_at", null)
      ).select("user_id");
      if (updateError) {
        return NextResponse.json({ error: "Couldn't save to your profile." }, { status: 500 });
      }
      if (!written || written.length === 0) continue;

      // Same stored figure the full profile save keeps fresh (the dashboard works it out live, but
      // other readers still use the stored one).
      const completeness = computeCompleteness(toScorableProfile({ ...profile, [section]: next }, appUser.full_name));
      await supabase.from("users").update({ profile_completeness: completeness }).eq("id", authUserId);
      return NextResponse.json({ saved: true });
    }

    return NextResponse.json({ error: "Your profile changed while saving. Please try again." }, { status: 409 });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("profile-entries error", error);
    return NextResponse.json({ error: "Couldn't save to your profile." }, { status: 500 });
  }
}
