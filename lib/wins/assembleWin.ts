import { sanitizeDeep } from "@/lib/text/sanitizeDashes";

export interface WinBuilderSlots {
  verb: string;
  what: string;
  tools: string[];
  stakeholders: string[];
  outcome: string;
}

function joinList(items: string[]): string {
  const clean = items.map((item) => item.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

/**
 * Assembles a win's structured slots into the display text stored as WorkExperienceWin.text.
 * Pure string work, zero API calls - the product only ever asks and slots, it never writes the
 * win. Any skipped slot drops out cleanly so the sentence still reads (see build brief rule 2:
 * a win with neither outcome nor number is still a legitimate bullet).
 *
 * The number (metric) is deliberately not concatenated here - it stays its own field, same as
 * every other metric/outcome_metric pair in the app (WinsField, ImpactField, RoleDutiesReview),
 * shown alongside the text rather than folded into it.
 *
 * Assumes at least one of verb/what is non-empty - the builder's step 1 requires `what` before
 * allowing Next, so this is never called with a fully blank lead.
 */
export function assembleWinText(slots: WinBuilderSlots): string {
  const verb = slots.verb.trim();
  const what = slots.what.trim();
  let sentence = [verb, what].filter(Boolean).join(" ");

  const toolsList = joinList(slots.tools);
  if (toolsList) sentence += ` in ${toolsList}`;

  const stakeholdersList = joinList(slots.stakeholders);
  if (stakeholdersList) sentence += ` for ${stakeholdersList}`;

  const outcome = slots.outcome.trim();
  const clauses = [sentence, outcome].filter((clause) => clause.length > 0);

  return sanitizeDeep(clauses.join(", "));
}
