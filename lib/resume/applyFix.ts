import type { ResumeContent } from "@/types";

/**
 * The full, server-resolved shape of a single honesty fix - see app/api/resume/[id]/fix/route.ts.
 * Pure, immutable transforms over ResumeContent, mirroring the exact array-update style already
 * used in components/resume/ResumeEditorForm.tsx (.map()/.filter(), never mutate in place).
 *
 * The four "align" variants always carry the value(s) to align to - but the CLIENT never supplies
 * them (see ClientFixResolution below): the API route always looks the real value up itself from
 * the profile (findSourceExperience/findSourceProject/profile.education[index], the same matchers
 * factCheck.ts uses to derive the flag in the first place) before calling applyFix. Trusting a
 * client-supplied align value would let a compromised/buggy client claim an "align" that's
 * actually a blend, which is exactly the kind of fix this feature must never allow.
 */
export type FixResolution =
  | { kind: "removeExperience"; index: number }
  | { kind: "removeProject"; index: number }
  | { kind: "removeReferee"; index: number }
  | { kind: "removeSkill"; index: number }
  | { kind: "removeTool"; index: number }
  | { kind: "removeSummaryPhrase"; phrase: string }
  | { kind: "removeExperienceBullet"; index: number; bulletIndex: number }
  | { kind: "removeProjectBullet"; index: number; bulletIndex: number }
  | { kind: "replaceExperienceBullet"; index: number; bulletIndex: number; text: string }
  | { kind: "replaceProjectBullet"; index: number; bulletIndex: number; text: string }
  | { kind: "alignExperienceField"; index: number; field: "company" | "job_title"; value: string }
  | { kind: "alignExperienceDates"; index: number; start_date: string; end_date: string }
  | { kind: "alignProjectTitle"; index: number; value: string }
  | { kind: "alignProjectYear"; index: number; value: string }
  | { kind: "alignEducationField"; index: number; field: "degree" | "institution"; value: string };

const ALIGN_KINDS = [
  "alignExperienceField",
  "alignExperienceDates",
  "alignProjectTitle",
  "alignProjectYear",
  "alignEducationField",
] as const;
type AlignKind = (typeof ALIGN_KINDS)[number];

/**
 * What the client is allowed to POST for a fix - identical to FixResolution except the four
 * "align" variants omit the value(s) they resolve to, since only the server is trusted to compute
 * those (see the doc comment on FixResolution above).
 */
export type ClientFixResolution =
  | Exclude<FixResolution, { kind: AlignKind }>
  | { kind: "alignExperienceField"; index: number; field: "company" | "job_title" }
  | { kind: "alignExperienceDates"; index: number }
  | { kind: "alignProjectTitle"; index: number }
  | { kind: "alignProjectYear"; index: number }
  | { kind: "alignEducationField"; index: number; field: "degree" | "institution" };

export function isAlignResolution(
  resolution: ClientFixResolution
): resolution is Extract<ClientFixResolution, { kind: AlignKind }> {
  return (ALIGN_KINDS as readonly string[]).includes(resolution.kind);
}

/** Removes the exact `phrase` substring, then collapses any resulting double spaces and trims a
 * now-dangling leading/trailing comma or period left behind (e.g. "  ." -> "."). Deliberately
 * simple - not a general grammar fixer. */
function removeSummaryPhrase(summary: string, phrase: string): string {
  return summary
    .replace(phrase, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/^[\s,.]+/, "")
    .trim();
}

export function applyFix(resume: ResumeContent, resolution: FixResolution): ResumeContent {
  switch (resolution.kind) {
    case "removeExperience":
      return { ...resume, experience: resume.experience.filter((_, i) => i !== resolution.index) };

    case "removeProject":
      return { ...resume, projects: resume.projects.filter((_, i) => i !== resolution.index) };

    case "removeReferee":
      return { ...resume, referees: resume.referees.filter((_, i) => i !== resolution.index) };

    case "removeSkill":
      return { ...resume, skills: resume.skills.filter((_, i) => i !== resolution.index) };

    case "removeTool":
      return { ...resume, tools: resume.tools.filter((_, i) => i !== resolution.index) };

    case "removeSummaryPhrase":
      return { ...resume, summary: removeSummaryPhrase(resume.summary, resolution.phrase) };

    case "removeExperienceBullet":
      return {
        ...resume,
        experience: resume.experience.map((entry, i) =>
          i === resolution.index
            ? { ...entry, bullets: entry.bullets.filter((_, bi) => bi !== resolution.bulletIndex) }
            : entry
        ),
      };

    case "removeProjectBullet":
      return {
        ...resume,
        projects: resume.projects.map((entry, i) =>
          i === resolution.index
            ? { ...entry, bullets: entry.bullets.filter((_, bi) => bi !== resolution.bulletIndex) }
            : entry
        ),
      };

    case "replaceExperienceBullet":
      return {
        ...resume,
        experience: resume.experience.map((entry, i) =>
          i === resolution.index
            ? { ...entry, bullets: entry.bullets.map((b, bi) => (bi === resolution.bulletIndex ? resolution.text : b)) }
            : entry
        ),
      };

    case "replaceProjectBullet":
      return {
        ...resume,
        projects: resume.projects.map((entry, i) =>
          i === resolution.index
            ? { ...entry, bullets: entry.bullets.map((b, bi) => (bi === resolution.bulletIndex ? resolution.text : b)) }
            : entry
        ),
      };

    case "alignExperienceField":
      return {
        ...resume,
        experience: resume.experience.map((entry, i) =>
          i === resolution.index ? { ...entry, [resolution.field]: resolution.value } : entry
        ),
      };

    case "alignExperienceDates":
      return {
        ...resume,
        experience: resume.experience.map((entry, i) =>
          i === resolution.index
            ? { ...entry, start_date: resolution.start_date, end_date: resolution.end_date }
            : entry
        ),
      };

    case "alignProjectTitle":
      return {
        ...resume,
        projects: resume.projects.map((entry, i) => (i === resolution.index ? { ...entry, title: resolution.value } : entry)),
      };

    case "alignProjectYear":
      return {
        ...resume,
        projects: resume.projects.map((entry, i) => (i === resolution.index ? { ...entry, year: resolution.value } : entry)),
      };

    case "alignEducationField":
      return {
        ...resume,
        education: resume.education.map((entry, i) =>
          i === resolution.index ? { ...entry, [resolution.field]: resolution.value } : entry
        ),
      };
  }
}
