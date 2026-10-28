import { stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import { updateExperience } from "@/lib/resume/resumeFieldUpdaters";
import type { ResumeContent, ResumeExperienceEntry, RoleDutyItem } from "@/types";

/** Fewer written bullets than this and a role reads as thin: the canvas makes Suggest tasks the
 * role toolbar's main action instead of Add bullet. */
export const THIN_ROLE_BULLETS = 3;

/** A task as the candidate last saw it - their own edit if they made one. */
export function taskText(item: Pick<RoleDutyItem, "duty_text" | "user_edited_text">): string {
  return item.user_edited_text?.trim() || item.duty_text.trim();
}

/** Comparison form: formatting, case, punctuation and spacing don't make a bullet a different task. */
function taskKey(text: string): string {
  return stripBulletMarkup(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const isWritten = (bullet: string) => stripBulletMarkup(bullet).trim().length > 0;

export function writtenBulletCount(entry: ResumeExperienceEntry): number {
  return entry.bullets.filter(isWritten).length;
}

export function isThinRole(entry: ResumeExperienceEntry): boolean {
  return writtenBulletCount(entry) < THIN_ROLE_BULLETS;
}

/** Checks tasks against a role's bullets - built once per role, then one lookup per task. */
export function roleTaskMatcher(entry: ResumeExperienceEntry): (text: string) => boolean {
  const keys = new Set(entry.bullets.map(taskKey));
  return (text) => keys.has(taskKey(text));
}

/** The tasks that would actually be added to this role: trimmed, in order, without ones it already
 * has or ones that repeat each other. What the panel adds - and so what its "Added N" counts. */
export function newTasksForRole(entry: ResumeExperienceEntry, texts: string[]): string[] {
  const seen = new Set(entry.bullets.map(taskKey));
  const fresh: string[] = [];
  for (const text of texts) {
    const key = taskKey(text);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    fresh.push(text.trim());
  }
  return fresh;
}

/**
 * Adds tasks to the end of a role's bullets. Existing bullets keep their places (review highlights
 * are tied to a bullet's position); only blanks left trailing at the end are dropped, so the new
 * bullets don't sit below an empty line - and a role with nothing written yet simply gets the tasks.
 */
export function addTasksToRole(resume: ResumeContent, index: number, texts: string[]): ResumeContent {
  const entry = resume.experience[index];
  if (!entry) return resume;
  const fresh = newTasksForRole(entry, texts);
  if (fresh.length === 0) return resume;
  let keep = entry.bullets.length;
  while (keep > 0 && !isWritten(entry.bullets[keep - 1])) keep--;
  return updateExperience(resume, index, { bullets: [...entry.bullets.slice(0, keep), ...fresh] });
}
