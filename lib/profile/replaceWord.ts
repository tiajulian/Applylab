import { escapeRegExp } from "@/lib/text/escapeRegExp";
import type { EducationEntry, ProjectEntry, UserProfile, WorkExperienceEntry } from "@/types";

/** The profile fields a spelling fix can touch: everything the candidate wrote as text. */
export type WordFixableProfile = Pick<UserProfile, "work_experience" | "projects" | "education" | "skills" | "tools">;

function wordPattern(word: string, flags = "g"): RegExp {
  // Same word boundaries as the review's spelling rule (lib/review/rules.ts), case-sensitive so
  // only the exact misspelling as written is replaced.
  return new RegExp(`(?<![A-Za-z0-9'-])${escapeRegExp(word)}(?![A-Za-z0-9'-])`, flags);
}

/** True when `word` appears anywhere in the profile's text, as a whole word. */
export function profileHasWord(profile: Partial<WordFixableProfile> | null | undefined, word: string): boolean {
  if (!profile || !word.trim()) return false;
  const pattern = wordPattern(word, "");
  const texts = [
    ...(profile.work_experience ?? []).flatMap((r) => [r.job_title, r.company, r.description, ...(r.wins ?? []).flatMap((w) => [w.text, w.what ?? "", w.outcome ?? ""])]),
    ...(profile.projects ?? []).flatMap((p) => [p.title, p.description, p.context, p.outcome, ...(p.tools ?? [])]),
    ...(profile.education ?? []).flatMap((e) => [e.degree, e.institution, e.notes]),
    ...(profile.skills ?? []),
    ...(profile.tools ?? []),
  ];
  return texts.some((text) => typeof text === "string" && pattern.test(text));
}

/**
 * Replaces every whole-word `from` with `to` across the profile's text fields, leaving everything
 * else (dates, metrics, links, picks) untouched. Returns the updated fields and how many were changed.
 */
export function replaceWordInProfile(
  profile: WordFixableProfile,
  from: string,
  to: string
): { profile: WordFixableProfile; replaced: number } {
  const pattern = wordPattern(from);
  let replaced = 0;
  const fix = (text: string | undefined): string => {
    if (!text) return text ?? "";
    return text.replace(pattern, () => {
      replaced += 1;
      return to;
    });
  };
  const fixOptional = (text: string | undefined) => (text === undefined ? undefined : fix(text));

  const work_experience: WorkExperienceEntry[] = (profile.work_experience ?? []).map((r) => ({
    ...r,
    job_title: fix(r.job_title),
    company: fix(r.company),
    description: fix(r.description),
    wins: (r.wins ?? []).map((w) => ({ ...w, text: fix(w.text), what: fixOptional(w.what), outcome: fixOptional(w.outcome) })),
  }));
  const projects: ProjectEntry[] = (profile.projects ?? []).map((p) => ({
    ...p,
    title: fix(p.title),
    description: fix(p.description),
    context: fix(p.context),
    outcome: fix(p.outcome),
    tools: (p.tools ?? []).map(fix),
  }));
  const education: EducationEntry[] = (profile.education ?? []).map((e) => ({
    ...e,
    degree: fix(e.degree),
    institution: fix(e.institution),
    notes: fix(e.notes),
  }));

  return {
    profile: { work_experience, projects, education, skills: (profile.skills ?? []).map(fix), tools: (profile.tools ?? []).map(fix) },
    replaced,
  };
}
