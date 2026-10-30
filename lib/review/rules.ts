import { BUZZWORDS, CONTEXT_BUZZWORDS, findBuzzwordMatch, PASSIVE_REGEX, shouldFlagBuzzword, buzzwordReason } from "@/lib/resume/contentChecks";
import { plainToMarkedOffset, stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import { checkResumeIntegrity } from "@/lib/resume/integrityChecks";
import { checkSpelling } from "@/lib/text/spellcheck";
import { findFiller, JOB_AD_FILLER } from "@/lib/text/jobAdFiller";
import { sanitizeDashes } from "@/lib/text/sanitizeDashes";
import { factCheckTargetKey, type ResumeContent } from "@/types";
import type { ReviewBlock } from "./blocks";
import { clampReason, type RawReviewItem } from "./types";

export interface RuleContext {
  /** The en-AU nspell checker; null when the dictionary could not load (spelling is then skipped). */
  checker: import("nspell") | null;
  knownWords: Set<string>;
  /** The user's own titles, employers, skills and tools: never flagged as job-ad wording. */
  protectedTerms: string[];
}

const PROSE_BLOCK = /^(summary|experienceBullet|projectBullet|customItem)/;
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
export function spellingItems(block: ReviewBlock, ctx: Pick<RuleContext, "checker" | "knownWords">): RawReviewItem[] {
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
export function styleItems(block: ReviewBlock, ctx?: Pick<RuleContext, "protectedTerms">): RawReviewItem[] {
  if (!BULLET_BLOCK.test(block.id)) return [];
  const items: RawReviewItem[] = [];
  // Detected against the plain text (a bolded participle or a buzzword phrase split by a marker
  // would otherwise be missed - see lib/resume/bulletMarkup.ts's own comment on why), then mapped
  // back to marked-up-string coordinates so start/end/before stay correct against block.text (the
  // raw stored bullet) the same way every other rule's offsets already are.
  const plain = stripBulletMarkup(block.text);
  const toMarked = (plainOffset: number, bias: "start" | "end" = "start") => plainToMarkedOffset(block.text, plainOffset, bias);
  const match = findBuzzwordMatch(plain, ctx?.protectedTerms);
  if (match) {
    const { phrase } = match;
    const start = toMarked(match.start);
    const end = toMarked(match.end, "end");
    // Keep the old identity for phrases previously emitted by wordingItems, so saved dismissals survive.
    const wasJobAd = findFiller(phrase, JOB_AD_FILLER).some((m) => m.start === 0 && m.end === phrase.length);
    items.push({
      kind: "fix", ruleId: wasJobAd ? "style.jobAd" : "style.buzzword", severity: "info", blockId: block.id, start, end,
      before: block.text.slice(start, end), after: "",
      reason: clampReason(buzzwordReason(phrase)),
    });
  }
  const passive = PASSIVE_REGEX.exec(plain);
  if (passive) {
    const start = toMarked(passive.index);
    const end = toMarked(passive.index + passive[0].length, "end");
    items.push({
      kind: "fix", ruleId: "style.passive", severity: "info", blockId: block.id,
      start, end, before: block.text.slice(start, end), after: "",
      reason: "Passive voice: lead with what you did",
    });
  }
  return items;
}

// Openers that describe a duty instead of what was done.
const WEAK_OPENER_REGEX =
  /^(\s*)(responsible for|duties included|duties include|tasked with|in charge of|involved in|worked on|helped( to)?|assisted( with)?)\b/i;

/**
 * The wording rules generation follows, as cards on the user's own text: em/en dashes in any
 * writable field (fixed the same way generation fixes them, see sanitizeDashes), job-ad filler in
 * prose (lib/text/jobAdFiller.ts - the user's own titles, employers, skills and tools never count),
 * and duty-style bullet openers. Filler and openers are flag-only: the bullet toolbar rewrites.
 */
export function wordingItems(block: ReviewBlock, ctx: Pick<RuleContext, "protectedTerms">): RawReviewItem[] {
  if (!block.writable || !block.text.trim()) return [];
  const items: RawReviewItem[] = [];
  for (const match of block.text.matchAll(/\s*[—–]\s*/g)) {
    // Just the dash and its spacing, so the fix never overlaps a fix on the words either side.
    // sanitizeDashes decides from the neighbouring words alone, so running it on dash + neighbours
    // gives this dash's replacement.
    const start = match.index;
    const end = start + match[0].length;
    const prev = block.text.slice(0, start).split(/\s+|[—–]/).pop() ?? "";
    const next = block.text.slice(end).split(/\s+|[—–]/)[0] ?? "";
    const fixed = sanitizeDashes(prev + match[0] + next);
    items.push({
      kind: "fix", ruleId: "style.dash", severity: "info", blockId: block.id, start, end,
      before: match[0], after: fixed.slice(prev.length, fixed.length - next.length),
      reason: "Long dashes can trip up hiring software: use a comma or hyphen",
    });
  }
  if (!PROSE_BLOCK.test(block.id)) return items;

  const plain = stripBulletMarkup(block.text);
  const toMarked = (plainOffset: number, bias: "start" | "end" = "start") => plainToMarkedOffset(block.text, plainOffset, bias);
  for (const filler of findFiller(plain, JOB_AD_FILLER, ctx.protectedTerms)) {
    // Bullet buzzwords are emitted once by styleItems, with the same policy as chips/scoring.
    if (BULLET_BLOCK.test(block.id) && [...BUZZWORDS, ...CONTEXT_BUZZWORDS].some((phrase) => filler.text.toLowerCase().includes(phrase))) continue;
    if (!shouldFlagBuzzword(plain, filler.text)) continue;
    const start = toMarked(filler.start);
    const end = toMarked(filler.end, "end");
    items.push({
      kind: "fix", ruleId: "style.jobAd", severity: "info", blockId: block.id, start, end,
      before: block.text.slice(start, end), after: "",
      reason: clampReason(buzzwordReason(filler.text)),
    });
  }

  const opener = BULLET_BLOCK.test(block.id) ? WEAK_OPENER_REGEX.exec(plain) : null;
  if (opener) {
    const start = toMarked(opener[1].length);
    const end = toMarked(opener[0].length, "end");
    items.push({
      kind: "fix", ruleId: "style.weakOpener", severity: "info", blockId: block.id, start, end,
      before: block.text.slice(start, end), after: "",
      reason: "Lead with what you did ('Ran', 'Built', 'Fixed'), not the duty",
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
      reason: clampReason(finding.title), detail: [finding.detail, finding.fix_text].filter(Boolean).join(" "), key: finding.id,
    });
  }
  return items;
}

