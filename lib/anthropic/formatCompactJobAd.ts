import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

function joinOrNone(items: string[]): string {
  return items.length > 0 ? items.join(", ") : "None stated";
}

/**
 * Full compact-JD block - everything parseJobAd extracted from the ad, formatted for a prompt.
 * Replaces the raw ad text entirely; never sits alongside it. Used by consumers that benefit
 * from the richer picture (ats-score, cover-letter, retailor's JD input).
 */
export function formatCompactJobAdFull(compact: CompactJobAd): string {
  return `
Seniority level: ${compact.seniority || "Not stated"}
Must-have skills: ${joinOrNone(compact.must_have_skills)}
Nice-to-have skills: ${joinOrNone(compact.nice_to_have_skills)}
Tools/platforms mentioned: ${joinOrNone(compact.tools)}
Key responsibilities: ${joinOrNone(compact.key_responsibilities)}
Other keywords to mirror: ${joinOrNone(compact.keywords)}
`.trim();
}

/**
 * Leanest possible JD summary - must-have skills and keywords only. Used by assist, which is
 * editing a single existing bullet and never needed the full ad, responsibilities list, or
 * nice-to-have/tools detail in the first place.
 */
export function formatCompactJobAdLean(compact: CompactJobAd): string {
  return `
Must-have skills: ${joinOrNone(compact.must_have_skills)}
Keywords to mirror: ${joinOrNone(compact.keywords)}
`.trim();
}
