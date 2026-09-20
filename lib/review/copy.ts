import type { ReviewItem } from "./types";

export type TrustTone = "safe" | "verify" | "fix";

/** The one-line reason at the top of an open card, in the colour that says how much attention it needs. */
export function trustLine(item: ReviewItem): { tone: TrustTone; text: string } {
  if (item.provenance === "reworded") return { tone: "safe", text: "Facts unchanged. Same numbers and tools as your profile." };
  if (item.provenance === "new_claim" && item.claims?.length) {
    const many = item.claims.length > 1;
    const claims = item.claims.map((c) => `'${c}'`).join(", ");
    return { tone: "verify", text: `New detail: ${claims} ${many ? "are" : "is"} not in your profile. Confirm ${many ? "them" : "it"} or edit ${many ? "them" : "it"} out.` };
  }
  if (item.provenance === "new_claim" || item.ruleId.startsWith("factcheck.")) return { tone: "verify", text: item.reason };
  return { tone: "fix", text: item.reason };
}

/** The buttons on an open card. Fixes change a few words, rewrites replace the whole wording. */
export function actionLabels(item: ReviewItem): { accept: string; keep: string } {
  return item.kind === "fix" ? { accept: "Apply fix", keep: "Dismiss" } : { accept: "Accept", keep: "Keep original" };
}

/** "Experience, Analytics Engineer" -> "Experience · Analytics Engineer", and the second half alone for done rows. */
export function sectionLabel(label: string): { full: string; short: string } {
  const [section, ...rest] = label.split(/,\s*/);
  const detail = rest.join(", ");
  return { full: detail ? `${section} · ${detail}` : section, short: detail || section };
}
