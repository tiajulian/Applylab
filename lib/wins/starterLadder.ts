import { roleFamilyStarters } from "@/lib/wins/roleFamilyBank";

const MIN_BULLET_LEN = 8;
const MAX_BULLET_LEN = 140;
const MIN_STARTERS = 2;
// Below this, a description is too thin for the AI extraction rung to have anything real to work
// from either - straight to the duties/title rungs instead of spending a call on it.
const MIN_DESCRIPTION_LEN_FOR_AI = 40;

/**
 * Zero-API heuristic split of a role's own free-text description into clean, bullet-like lines.
 * Same line/sentence-boundary idea as lib/profile/thinExperience.ts's taskLineCount, but returns
 * the actual trimmed lines (capped) instead of just a count.
 */
export function splitDescriptionBullets(description: string): string[] {
  return description
    .split(/[\n•]+|(?<=[.;])\s+/)
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter((line) => line.length >= MIN_BULLET_LEN && line.length <= MAX_BULLET_LEN)
    .slice(0, 5);
}

export type StarterSource = "description" | "description-ai" | "duties" | "title";

export interface StarterLadderResult {
  starters: string[];
  source: StarterSource;
}

/**
 * Part F personalisation ladder for the Win Builder's step 1 - seeds tap-to-use starters so the
 * user rarely opens to a fully blank "what did you do?" field. Every starter is still just a
 * suggestion the user taps, edits, or ignores; nothing here is ever auto-added to the win.
 *
 * Rungs, in order, first one that yields anything wins:
 * 1. The role's own description, split into clean bullets - zero API.
 * 2. If the description has real content but doesn't split cleanly (a dense paragraph rather than
 *    line-separated notes), a single cached-for-this-session Haiku call extracts short phrases
 *    from that same text - never invents new ones. Called at most once per role per builder
 *    session (guarded by the caller), never on keystroke or load.
 * 3. The candidate's own confirmed duties for this job title, if any exist yet - zero API,
 *    read-only lookup (GET /api/role-duties).
 * 4. A fixed question bank keyed to the job title's role family - zero API, always available.
 */
export async function getStarterSuggestions(
  description: string,
  jobTitle: string
): Promise<StarterLadderResult> {
  const cleanDescription = description.trim();

  const bulletSplit = splitDescriptionBullets(cleanDescription);
  if (bulletSplit.length >= MIN_STARTERS) {
    return { starters: bulletSplit, source: "description" };
  }

  if (cleanDescription.length >= MIN_DESCRIPTION_LEN_FOR_AI) {
    try {
      const response = await fetch("/api/win-starters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: cleanDescription }),
      });
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const aiStarters: string[] = Array.isArray(data.starters) ? data.starters : [];
        if (aiStarters.length > 0) {
          return { starters: aiStarters, source: "description-ai" };
        }
      }
    } catch {
      // Falls through to the next rung - this is a personalisation nicety, never a blocker.
    }
  }

  if (jobTitle.trim()) {
    try {
      const response = await fetch(`/api/role-duties?jobTitle=${encodeURIComponent(jobTitle.trim())}`);
      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        const duties: string[] = Array.isArray(data.duties) ? data.duties : [];
        if (duties.length > 0) {
          return { starters: duties.slice(0, 5), source: "duties" };
        }
      }
    } catch {
      // Falls through to the title rung, which always returns something.
    }
  }

  return { starters: roleFamilyStarters(jobTitle), source: "title" };
}
