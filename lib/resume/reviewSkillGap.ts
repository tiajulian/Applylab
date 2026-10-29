import type { ResumeContent, SkillsBridgeItem } from "@/types";

export interface ReviewSkillGap {
  bridgeId: string;
  items: SkillsBridgeItem[];
}

const normalise = (text: string) => text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

/** Role identity must be unambiguous. Never attach evidence to a guessed employer or title. */
export function skillGapRole(content: ResumeContent, item: SkillsBridgeItem): number | null {
  if (!item.source_company.trim() || !item.source_job_title.trim()) return null;
  const matches = content.experience.flatMap((role, index) =>
    normalise(role.company) === normalise(item.source_company) && normalise(role.job_title) === normalise(item.source_job_title) ? [index] : []);
  return matches.length === 1 ? matches[0] : null;
}

export function confirmedSkillEvidence(item: SkillsBridgeItem): string | null {
  if (item.state === "gap" || item.user_state !== "confirmed") return null;
  // An AI question is never resume wording. Use the person's note or their quoted source.
  return item.user_note?.trim() || (item.state === "matched" ? item.source_snippet.trim() : "") || null;
}
