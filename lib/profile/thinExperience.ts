import type { WorkExperienceEntry } from "@/types";

// A description under this length almost never has enough content to write a real bullet from
// (e.g. "Handled customer service" is 26 characters) - below it we don't even bother counting
// task lines. Chosen to sit well under a genuinely short-but-real one-liner while still catching
// single-word/near-empty entries. See lib/profile/thinExperience.test.ts for the calibration
// cases (a bare ABC-style entry vs. a normal multi-line role description).
const MIN_DESCRIPTION_LENGTH = 60;

// Below this many distinct task-like lines, there usually isn't enough for the resume prompt to
// quantify and polish into real bullets without leaning on the target job description to pad it.
const MIN_TASK_LINES = 2;

function taskLineCount(description: string): number {
  return description
    .split(/[\n•]+|(?<=[.;])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8).length;
}

/**
 * Flags a work_experience entry too thin to write a real resume from - empty, very short, or a
 * single task line. Deliberately a simple length/line-count heuristic, not an LLM call: this only
 * decides whether to *offer* the role-duties suggestion flow, so a false positive just means an
 * unnecessary (dismissible) prompt, not a wrong output.
 */
export function isThinExperience(entry: Pick<WorkExperienceEntry, "description">): boolean {
  const description = entry.description?.trim() ?? "";
  if (description.length === 0) return true;
  if (description.length < MIN_DESCRIPTION_LENGTH) return true;
  return taskLineCount(description) < MIN_TASK_LINES;
}
