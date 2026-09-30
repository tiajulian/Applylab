// Builds a job profile from what the app already knows about the user, so Job Matcher works
// without a form: target roles from the resumes they tailored and jobs they applied to (falling
// back to their current role), skills and location from their profile (searched within the
// default radius, so a suburb covers its metro area), and recent work history as background text
// for the embedding.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CITY_STATES } from "@/lib/jobs/locations";
import { findPlaceName, parsePlace, STATES } from "@/lib/jobs/places";
import { EMPTY_PROFILE, PROFILE_LIMITS, type JobProfileInput } from "@/lib/jobs/profile";
import { normalizeWorkExperience } from "@/lib/profile/normalizeWorkExperience";
import { sortByRecency } from "@/lib/profile/parseRoleDate";
import type { WorkExperienceEntry } from "@/types";

const RECENT_TITLES = 20;
const BACKGROUND_ROLES = 3;
const BACKGROUND_CHARS = 2000;

// Resume/application labels that aren't job titles ("General resume", "Manual application").
const NOT_A_TITLE = /^(?:(?:general|master|base|default|my|new|sample)\s+)?(?:resume|cv|application|job)s?$|^manual application$|^untitled/i;

/** A usable target title, or null. Drops page-title suffixes ("Analyst | Dayforce Jobs"). */
export function cleanTitle(raw: string | null | undefined): string | null {
  const title = raw?.split(" | ")[0].trim().replace(/\s+/g, " ");
  return title && !NOT_A_TITLE.test(title) ? title : null;
}

const hasWord = (text: string, word: string) =>
  new RegExp(`(?<![a-z])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i").test(text);

const CITIES = Object.keys(CITY_STATES);

/** A city named in the text, else its state ("Greater Perth WA" -> "Perth", "Parramatta, NSW" ->
 * "New South Wales", "Victoria Park, WA" -> "Western Australia"), or null when it names neither. */
export function normalizeAuLocation(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const { name, state } = parsePlace(raw);
  const city = CITIES.find((place) => hasWord(name, place.toLowerCase()));
  return city ?? (state ? STATES[state] : null);
}

/**
 * The profile location as a known place ("kogarah 2217" -> "Kogarah"; the distance search then
 * covers its surroundings), else a city or state named in the text, else null for all of Australia.
 */
async function resolveLocation(supabase: SupabaseClient, raw: string | null): Promise<string | null> {
  if (!raw?.trim()) return null;
  return (await findPlaceName(supabase, raw)) ?? normalizeAuLocation(raw);
}

/** Case-insensitive dedupe that keeps first-seen order, drops blanks/placeholders, and caps length. */
function uniqueItems(values: (string | null | undefined)[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const value = raw?.trim().replace(/\s+/g, " ").slice(0, PROFILE_LIMITS.itemChars);
    if (!value || /\[[^\]]*\]/.test(value) || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
    if (out.length === max) break;
  }
  return out;
}

export interface AutoProfileSources {
  skills: string[] | null;
  /** Already resolved to a known place, city or state (see resolveLocation), or null for all of Australia. */
  location: string | null;
  workExperience: WorkExperienceEntry[] | null;
  /** Newest first. */
  resumeTitles: (string | null)[];
  /** Newest first. */
  applicationTitles: (string | null)[];
}

/** Null when there is nothing to match on (no target role and no skills). */
export function buildAutoProfile(sources: AutoProfileSources): JobProfileInput | null {
  const roles = sortByRecency(normalizeWorkExperience(sources.workExperience));
  const targetTitles = uniqueItems(
    [...sources.resumeTitles, ...sources.applicationTitles, roles[0]?.job_title].map(cleanTitle),
    PROFILE_LIMITS.targetTitles
  );
  const skills = uniqueItems(sources.skills ?? [], PROFILE_LIMITS.skills);
  if (targetTitles.length === 0 && skills.length === 0) return null;

  const location = sources.location;
  const background = roles
    .slice(0, BACKGROUND_ROLES)
    .map((r) => [r.job_title && r.company ? `${r.job_title} at ${r.company}` : r.job_title || r.company, r.description?.trim()].filter(Boolean).join(". "))
    .filter(Boolean)
    .join("\n")
    .slice(0, BACKGROUND_CHARS);

  return {
    ...EMPTY_PROFILE,
    targetTitles,
    skills,
    locations: location ? [location] : [],
    resumeText: background || null,
  };
}

export async function deriveJobProfile(supabase: SupabaseClient, userId: string): Promise<JobProfileInput | null> {
  const [profile, resumes, applications] = await Promise.all([
    supabase.from("user_profiles").select("skills, location, work_experience").eq("user_id", userId).maybeSingle(),
    supabase.from("resumes").select("job_title").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT_TITLES),
    supabase.from("applications").select("job_title").eq("user_id", userId).order("created_at", { ascending: false }).limit(RECENT_TITLES),
  ]);
  for (const result of [profile, resumes, applications]) if (result.error) throw result.error;

  return buildAutoProfile({
    skills: profile.data?.skills ?? null,
    location: await resolveLocation(supabase, profile.data?.location ?? null),
    workExperience: (profile.data?.work_experience as WorkExperienceEntry[] | null) ?? null,
    resumeTitles: (resumes.data ?? []).map((r) => r.job_title as string | null),
    applicationTitles: (applications.data ?? []).map((a) => a.job_title as string | null),
  });
}
