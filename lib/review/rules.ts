import { BUZZWORDS, PASSIVE_REGEX } from "@/lib/resume/contentChecks";
import { checkResumeIntegrity } from "@/lib/resume/integrityChecks";
import { checkSpelling } from "@/lib/text/spellcheck";
import { factCheckTargetKey, type FactCheckFlag, type ResumeContent } from "@/types";
import type { ReviewBlock } from "./blocks";
import { clampReason, type RawReviewItem } from "./types";

export interface RuleContext {
  /** The en-AU nspell checker; null when the dictionary could not load (spelling is then skipped). */
  checker: import("nspell") | null;
  knownWords: Set<string>;
}

const PROSE_BLOCK = /^(summary|experienceBullet|projectBullet)/;
const BULLET_BLOCK = /^(experienceBullet|projectBullet)/;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True for the US-to-AU spelling pairs (-ize/-ise, -or/-our, -er/-re) so the reason can say so. */
function isAustralianVariant(word: string, suggestion: string): boolean {
  const w = word.toLowerCase();
  const s = suggestion.toLowerCase();
  return (
    w.replace(/iz(e|ed|es|ing|ation|ations)\b/g, "is$1") === s ||
    w.replace(/or\b/g, "our") === s ||
    w.replace(/or(s|ed|ing)\b/g, "our$1") === s ||
    w.replace(/er\b/g, "re") === s
  );
}

/** Every occurrence of each misspelled word in a prose block, with the top suggestion as the fix. */
export function spellingItems(block: ReviewBlock, ctx: RuleContext): RawReviewItem[] {
  if (!ctx.checker || !PROSE_BLOCK.test(block.id) || !block.text.trim()) return [];
  const items: RawReviewItem[] = [];
  for (const { word, suggestions } of checkSpelling(block.text, ctx.checker, ctx.knownWords)) {
    const suggestion = suggestions[0] ?? "";
    const reason =
      suggestion && isAustralianVariant(word, suggestion)
        ? `Australian English: '${suggestion}'`
        : `Possible spelling mistake: '${word}'`;
    const pattern = new RegExp(`(?<![A-Za-z0-9'-])${escapeRegex(word)}(?![A-Za-z0-9'-])`, "gi");
    for (const match of block.text.matchAll(pattern)) {
      items.push({
        kind: "fix", ruleId: "spelling", severity: "warn", blockId: block.id,
        start: match.index, end: match.index + match[0].length,
        before: match[0], after: matchCase(match[0], suggestion), reason: clampReason(reason),
      });
    }
  }
  return items;
}

/** A sentence-initial word must not lose its capital when replaced (see also replaceWord in shared.tsx). */
function matchCase(original: string, replacement: string): string {
  if (!replacement) return "";
  if (original === original.toUpperCase() && original !== original.toLowerCase()) return replacement.toUpperCase();
  return original[0] === original[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

/** The analyzer's per-bullet style rules (buzzwords, passive voice), listed but never highlighted. */
export function styleItems(block: ReviewBlock): RawReviewItem[] {
  if (!BULLET_BLOCK.test(block.id)) return [];
  const items: RawReviewItem[] = [];
  const lower = block.text.toLowerCase();
  for (const phrase of BUZZWORDS) {
    const start = lower.indexOf(phrase);
    if (start === -1) continue;
    items.push({
      kind: "fix", ruleId: "style.buzzword", severity: "info", blockId: block.id, start, end: start + phrase.length,
      before: block.text.slice(start, start + phrase.length), after: "",
      reason: clampReason(`Buzzword: '${phrase}' says little, show it with a result`),
    });
    break;
  }
  const passive = PASSIVE_REGEX.exec(block.text);
  if (passive) {
    items.push({
      kind: "fix", ruleId: "style.passive", severity: "info", blockId: block.id,
      start: passive.index, end: passive.index + passive[0].length, before: passive[0], after: "",
      reason: "Passive voice: lead with what you did",
    });
  }
  return items;
}

/** The existing integrity findings that point at one field (whole-field). A finding whose correction is
 * mechanical (a capital letter, an obvious typo) carries the corrected text, so its card can offer Apply fix;
 * the rest stay flag-only. */
export function integrityItems(content: ResumeContent, blocks: ReviewBlock[]): RawReviewItem[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const items: RawReviewItem[] = [];
  for (const finding of checkResumeIntegrity(content)) {
    const block = finding.target && byId.get(factCheckTargetKey(finding.target));
    if (!block || !block.text) continue;
    items.push({
      kind: "fix", ruleId: finding.id.replace(/(-\d+)+$/, "").replace("integrity-", "integrity."),
      severity: finding.severity === "info" ? "info" : "warn", blockId: block.id, start: 0, end: block.text.length,
      before: block.text, after: finding.replacement && finding.replacement !== block.text ? finding.replacement : "",
      reason: clampReason(finding.title), key: finding.id,
    });
  }
  return items;
}

/** Stored honesty flags that point at a field, as verify-level Changes. Emitted only while the
 * flagged text is still there, so editing the claim away resolves the item. */
export function flagItems(flags: FactCheckFlag[], blocks: ReviewBlock[]): RawReviewItem[] {
  const byId = new Map(blocks.map((b) => [b.id, b]));
  const items: RawReviewItem[] = [];
  for (const flag of flags) {
    if (!flag.target) continue;
    const block = byId.get(factCheckTargetKey(flag.target));
    if (!block || !block.text) continue;
    const at = flag.value ? block.text.toLowerCase().indexOf(flag.value.toLowerCase()) : -1;
    if (flag.value && at === -1) continue;
    const [start, end] = at === -1 ? [0, block.text.length] : [at, at + flag.value.length];
    items.push({
      kind: "change", ruleId: `factcheck.${flag.target.kind}`, severity: "verify", provenance: "new_claim",
      blockId: block.id, start, end, before: "", after: block.text, reason: clampReason(flag.message),
      key: `${flag.value}|${flag.message}`,
    });
  }
  return items;
}
