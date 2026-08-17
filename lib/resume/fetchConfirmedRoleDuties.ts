import { createClient } from "@/lib/supabase/server";
import { buildConfirmedRoleDuties, normalize } from "@/lib/resume/factCheck";
import type { ConfirmedRoleDuty, RoleDutyItem, RoleDutySuggestion, WorkExperienceEntry } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

/**
 * Unlike the skills bridge, this isn't opt-in per generation via an id the client passes - every
 * confirmed role duty a candidate has ever ticked for a job title automatically applies to any
 * work_experience entry sharing that title (see Phase 1 rationale: fix a role once, benefit every
 * future resume). A profile with no thin roles, or none ever suggested/confirmed, simply yields
 * no rows here, so this is a no-op query for the common case, not an extra round trip that
 * changes behaviour.
 *
 * Shared by app/api/generate-resume/route.ts and app/api/resume/[id]/fix/route.ts, so a fix's
 * re-check sees exactly the same confirmed-duties evidence generation-time fact-checking did -
 * duplicating this query would risk the re-check silently behaving more leniently/strictly than
 * generation, which would be a real honesty bug.
 */
export async function fetchRoleDutiesContext(
  supabase: SupabaseServerClient,
  userId: string,
  workExperience: WorkExperienceEntry[]
): Promise<ConfirmedRoleDuty[]> {
  const jobTitles = Array.from(
    new Set(workExperience.map((e) => normalize(e.job_title)).filter((title) => title.length > 0))
  );
  if (jobTitles.length === 0) return [];

  const { data: suggestions } = await supabase
    .from("role_duty_suggestions")
    .select("*")
    .eq("user_id", userId)
    .in("job_title", jobTitles);

  const suggestionRows = (suggestions ?? []) as RoleDutySuggestion[];
  if (suggestionRows.length === 0) return [];

  const { data: items } = await supabase
    .from("role_duty_items")
    .select("*")
    .in(
      "suggestion_id",
      suggestionRows.map((s) => s.id)
    )
    .eq("user_state", "confirmed");

  return buildConfirmedRoleDuties(suggestionRows, (items ?? []) as RoleDutyItem[], workExperience);
}
