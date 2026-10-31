import type {
  EducationEntry,
  ProfileCompletenessResult,
  ProfileTask,
  RefereeEntry,
  UserProfile,
  WorkExperienceEntry,
} from "@/types";
import { parseRoleDate, parseEntryEnd } from "@/lib/profile/parseRoleDate";

export type ScorableProfile = Pick<
  UserProfile,
  | "work_rights"
  | "phone"
  | "location"
  | "linkedin_url"
  | "portfolio_url"
  | "github_url"
  | "work_experience"
  | "education"
  | "skills"
  | "referees"
  | "raw_linkedin_paste"
> & { fullName: string };

export type MvpFieldKey = "fullName" | "experience" | "skills" | "location" | "workRights";

export const MVP_FIELD_LABELS: Record<MvpFieldKey, string> = {
  fullName: "Full name",
  experience: "At least one work experience entry",
  skills: "At least 3 skills",
  location: "Location",
  workRights: "Work rights",
};

function nonEmpty(value: string | null | undefined): boolean {
  return !!value && value.trim().length > 0;
}

function isCompleteExperience(entry: WorkExperienceEntry): boolean {
  return nonEmpty(entry.job_title) && nonEmpty(entry.company) && nonEmpty(entry.description);
}

function isCompleteEducation(entry: EducationEntry): boolean {
  return nonEmpty(entry.degree) && nonEmpty(entry.institution);
}

export function getMissingMvpFields(profile: ScorableProfile): MvpFieldKey[] {
  const missing: MvpFieldKey[] = [];

  if (!nonEmpty(profile.fullName)) missing.push("fullName");
  if (!(profile.work_experience ?? []).some(isCompleteExperience)) missing.push("experience");
  if ((profile.skills ?? []).filter((s) => nonEmpty(s)).length < 3) missing.push("skills");
  if (!nonEmpty(profile.location)) missing.push("location");
  if (!nonEmpty(profile.work_rights)) missing.push("workRights");

  return missing;
}

/**
 * The stored profile row shaped for scoring. Shared so every page that shows a completeness
 * figure computes it from identical inputs and can never disagree with another.
 */
export function toScorableProfile(
  profile: Partial<Omit<ScorableProfile, "fullName">> | null,
  fullName: string | null | undefined
): ScorableProfile {
  return {
    fullName: fullName?.trim() ?? "",
    work_rights: profile?.work_rights ?? null,
    phone: profile?.phone ?? null,
    location: profile?.location ?? null,
    linkedin_url: profile?.linkedin_url ?? null,
    portfolio_url: profile?.portfolio_url ?? null,
    github_url: profile?.github_url ?? null,
    raw_linkedin_paste: profile?.raw_linkedin_paste ?? null,
    skills: profile?.skills ?? [],
    work_experience: profile?.work_experience ?? [],
    education: profile?.education ?? [],
    referees: profile?.referees ?? [],
  };
}

export function meetsMVP(profile: ScorableProfile): boolean {
  return getMissingMvpFields(profile).length === 0;
}

/**
 * Evaluates the 9 structured profile gap tasks (Spec 07) and derives percent completeness.
 */
export function getProfileCompleteness(
  profile: ScorableProfile,
  confirmedDutiesPerRole?: Map<string, number> | number
): ProfileCompletenessResult {
  const tasks: ProfileTask[] = [];

  // 1. Contact (10%, blocking)
  const hasPhone = nonEmpty(profile.phone);
  const hasLocation = nonEmpty(profile.location);
  const hasWorkRights = nonEmpty(profile.work_rights);
  const contactDone = hasPhone && hasLocation && hasWorkRights;

  const missingContact: string[] = [];
  if (!hasPhone) missingContact.push("phone");
  if (!hasLocation) missingContact.push("location");
  if (!hasWorkRights) missingContact.push("work rights");

  const contactLabel = contactDone
    ? "Contact details added"
    : missingContact.length === 3
    ? "Add your phone, location and work rights"
    : `Add your ${missingContact.join(" and ")}`;

  tasks.push({
    id: "contact",
    done: contactDone,
    label: contactLabel,
    severity: "blocking",
    weight: 10,
    href: "/profile#contact",
    unlocks: "Contact information for recruiters",
  });

  // 2. Roles minimum >= 2 (15%, blocking)
  const completeRoles = (profile.work_experience ?? []).filter(isCompleteExperience);
  const roleCount = completeRoles.length;
  const rolesDone = roleCount >= 2;
  const rolesNeeded = Math.max(0, 2 - roleCount);

  tasks.push({
    id: "roles_min",
    done: rolesDone,
    label: rolesDone ? "Jobs added" : `Add ${rolesNeeded} more job${rolesNeeded === 1 ? "" : "s"} you've had`,
    severity: "blocking",
    weight: 15,
    href: "/profile#experience",
    unlocks: "Chronological work history",
  });

  // 3. Duties confirmed (20%, blocking)
  // Every role has >= 3 confirmed duties. If no duties map passed, fallback to checking if each role description or wins is rich.
  let dutiesDone = false;
  let dutyRoleTitleToFix = "";

  if (roleCount === 0) {
    dutiesDone = false;
    dutyRoleTitleToFix = "your roles";
  } else if (typeof confirmedDutiesPerRole === "number") {
    dutiesDone = confirmedDutiesPerRole >= roleCount * 3;
    dutyRoleTitleToFix = completeRoles[0]?.job_title || "your roles";
  } else if (confirmedDutiesPerRole instanceof Map) {
    let allConfirmed = true;
    for (const role of completeRoles) {
      const confirmed = confirmedDutiesPerRole.get(role.job_title.trim().toLowerCase()) ?? 0;
      if (confirmed < 3) {
        allConfirmed = false;
        if (!dutyRoleTitleToFix) {
          dutyRoleTitleToFix = role.job_title;
        }
      }
    }
    dutiesDone = allConfirmed;
  } else {
    // If not provided, check if role descriptions/wins provide at least 3 items or standard fullness
    const allHaveRichContent = completeRoles.every(
      (r) => (r.wins && r.wins.length >= 1) || (r.description && r.description.length >= 60)
    );
    dutiesDone = allHaveRichContent && roleCount >= 2;
    dutyRoleTitleToFix = completeRoles[0]?.job_title || "your roles";
  }

  tasks.push({
    id: "duties_confirmed",
    done: dutiesDone,
    label: dutiesDone
      ? "Duties added for each job"
      : `Add what you did as ${dutyRoleTitleToFix || "each job"}`,
    severity: "blocking",
    weight: 20,
    href: "/profile#experience",
    unlocks: "Grounded resume generator",
  });

  // 4. Wins minimum >= 3 across all roles (15%, important)
  const allWins = (profile.work_experience ?? []).flatMap((r) => r.wins ?? []);
  const totalWins = allWins.filter((w) => nonEmpty(w.text)).length;
  const winsDone = totalWins >= 3;
  const winsNeeded = Math.max(0, 3 - totalWins);

  tasks.push({
    id: "wins_min",
    done: winsDone,
    label: winsDone ? "Achievements added" : `Add ${winsNeeded} more achievement${winsNeeded === 1 ? "" : "s"}`,
    severity: "important",
    weight: 15,
    href: "/profile#experience",
    unlocks: "Impact bullet points",
  });

  // 5. Skills minimum >= 8 (10%, important)
  const validSkills = (profile.skills ?? []).filter(nonEmpty);
  const skillsCount = validSkills.length;
  const skillsDone = skillsCount >= 8;
  const skillsNeeded = Math.max(0, 8 - skillsCount);

  tasks.push({
    id: "skills_min",
    done: skillsDone,
    label: skillsDone ? "Skills added" : `Add ${skillsNeeded} more skill${skillsNeeded === 1 ? "" : "s"}`,
    severity: "important",
    weight: 10,
    href: "/profile#skills",
    unlocks: "ATS keyword matching",
  });

  // 6. Education >= 1 (8%, important)
  const validEducation = (profile.education ?? []).filter(isCompleteEducation);
  const eduDone = validEducation.length >= 1;

  tasks.push({
    id: "education",
    done: eduDone,
    label: eduDone ? "Education added" : "Add your highest qualification",
    severity: "important",
    weight: 8,
    href: "/profile#education",
    unlocks: "Verified qualifications",
  });

  // 7. Date gaps > 6 months between roles (10%, important)
  let dateGapsDone = false;
  let gapYear = "";

  if (completeRoles.length >= 2) {
    // Sort roles chronologically
    const sorted = completeRoles
      .map((role) => {
        const start = parseRoleDate(role.start_date, 0);
        const end = parseEntryEnd(role, 11);
        return { role, start, end };
      })
      .filter((r) => r.start !== null && r.end !== null)
      .sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

    let hasGap = false;
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentRoleEnd = sorted[i].end!;
      const nextRoleStart = sorted[i + 1].start!;
      const gapMonths = nextRoleStart - currentRoleEnd;

      if (gapMonths > 6) {
        // Gap detected. Check if raw_linkedin_paste or notes explain it
        const hasGapNote = Boolean(
          profile.raw_linkedin_paste && profile.raw_linkedin_paste.toLowerCase().includes("gap")
        );
        if (!hasGapNote) {
          hasGap = true;
          const year = Math.floor(currentRoleEnd / 12);
          gapYear = year > 1970 ? String(year) : "career";
          break;
        }
      }
    }
    dateGapsDone = !hasGap;
  }

  tasks.push({
    id: "date_gaps",
    done: dateGapsDone,
    label: dateGapsDone
      ? "No gaps between jobs"
      : `Explain the ${gapYear ? `${gapYear} ` : ""}gap between jobs`,
    severity: "important",
    weight: 10,
    href: "/profile#experience",
    unlocks: "Continuous career timeline",
  });

  // 8. Metrics on at least 1 win (7%, polish)
  const hasWinMetric = allWins.some((w) => nonEmpty(w.metric) || nonEmpty(w.outcome));
  const metricsDone = hasWinMetric;

  tasks.push({
    id: "metrics",
    done: metricsDone,
    label: metricsDone ? "Numbers added to an achievement" : "Add a number to an achievement (e.g. 30% faster)",
    severity: "polish",
    weight: 7,
    href: "/profile#experience",
    unlocks: "Quantified recruiter impact",
  });

  // 9. Referees >= 1 (5%, polish)
  const validReferees = (profile.referees ?? []).filter((r) => nonEmpty(r.name));
  const refereesDone = validReferees.length >= 1;

  tasks.push({
    id: "referees",
    done: refereesDone,
    label: refereesDone ? "Referee added" : "Add one referee",
    severity: "polish",
    weight: 5,
    href: "/profile#referees",
    unlocks: "Direct reference check",
  });

  // Compute derived percent: sum of weights of completed tasks
  const percent = Math.min(
    100,
    tasks.reduce((sum, task) => (task.done ? sum + task.weight : sum), 0)
  );

  const incompleteTasks = tasks.filter((t) => !t.done);
  const nextTasks = incompleteTasks.slice(0, 3);

  // Suggestion text derived from nextTasks
  const suggestionText = joinSuggestions(
    nextTasks.map((t) => t.label.replace(/^Add /, "").replace(/^Confirm /, ""))
  );

  return {
    percent,
    tasks,
    nextTasks,
    suggestionText,
  };
}

/**
 * What to add next, for "Add {suggestions} to unlock..." lines outside the Profile page (e.g. New
 * resume). The same tasks, in the same order, as the Profile page's "Add next" list
 * (getProfileCompleteness), so the two pages never give different advice.
 */
export function getImprovementSuggestions(profile: ScorableProfile, max = 2): string[] {
  return getProfileCompleteness(profile)
    .nextTasks.filter((task) => task.label.startsWith("Add "))
    .slice(0, max)
    .map((task) => task.label.slice("Add ".length));
}

/** Joins suggestions into "your phone number and 2 more skills" / "your phone number" / "" (Oxford-comma-free). */
export function joinSuggestions(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  if (suggestions.length === 1) return suggestions[0];
  return `${suggestions.slice(0, -1).join(", ")} and ${suggestions[suggestions.length - 1]}`;
}

export function computeCompleteness(profile: ScorableProfile): number {
  return getProfileCompleteness(profile).percent;
}
