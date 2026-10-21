import type { ResumeContent } from "@/types";

/**
 * Fill-in-the-blank markers in suggested rewrites ("cut processing time by [X]%", "[Y] cases",
 * "in [add tool]"). They're prompts for the candidate's own figures and details, so they must never
 * be applied as-is or reach a downloaded resume. Brackets a candidate wrote on purpose
 * ("[confidential client]", "Python [Airflow]") don't count.
 */
const BRACKETED = /\[[^\]\n]{1,80}\]/g;
/** "[X]", "[Y] cases", "[X million rows]", "[N%]": a lone capital letter standing in for a figure. */
const LETTER_BLANK = /^\[[XYZN](?:[^A-Za-z][^\]]*)?\]$/;
/** "[number]", "[insert metric]", "[add %]", "[add tool]": wording that asks for a figure or detail. */
const WORDED_BLANK = /\b(?:number|amount|figure|metric|percent(?:age)?|insert|add|specify|tbc|tbd)\b|%|\$/i;

export function fillInPlaceholders(text: string | null | undefined): string[] {
  if (!text) return [];
  return Array.from(text.matchAll(BRACKETED), (m) => m[0]).filter((b) => LETTER_BLANK.test(b) || WORDED_BLANK.test(b));
}

export function hasFillInPlaceholder(text: string | null | undefined): boolean {
  return fillInPlaceholders(text).length > 0;
}

/** Every placeholder left in the parts of a resume a suggestion can write to. */
export function resumePlaceholders(content: ResumeContent): string[] {
  const texts = [
    content.summary,
    ...(content.experience ?? []).flatMap((entry) => entry.bullets ?? []),
    ...(content.projects ?? []).flatMap((project) => project.bullets ?? []),
  ];
  return Array.from(new Set(texts.flatMap(fillInPlaceholders)));
}

export function placeholderExportError(found: string[]): string {
  return `Fill in the blanks in your resume before downloading: ${found.slice(0, 3).join(", ")}${found.length > 3 ? "…" : ""}. Replace them with your real details, or delete them.`;
}
