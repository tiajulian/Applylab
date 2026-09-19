import type { ReviewItem } from "./types";

/** The plain-language wording of a card: what it is (title) and the one button that resolves it.
 * Kept out of the components so the wording lives in one place and can be tested. */
export function cardCopy(item: ReviewItem): { title: string; primary: string } {
  if (item.ruleId === "spelling") {
    return { title: item.reason.startsWith("Australian English") ? "Australian spelling" : "Spelling mistake", primary: "Fix" };
  }
  if (item.provenance === "new_claim" || item.ruleId.startsWith("factcheck.")) {
    return { title: "Check this claim", primary: "It's true" };
  }
  if (item.provenance === "reworded") return { title: "AI reworded this bullet", primary: "Looks good" };
  if (item.ruleId === "style.buzzword") return { title: "Vague phrase", primary: "Fix" };
  if (item.ruleId === "style.passive") return { title: "Passive wording", primary: "Fix" };
  if (item.ruleId.startsWith("integrity.")) return { title: "Needs a look", primary: "Fix" };
  return { title: item.kind === "fix" ? "Fix" : "Change", primary: item.kind === "fix" ? "Fix" : "Looks good" };
}
