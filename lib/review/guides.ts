import { markedToPlainOffset, parseBulletMarkup, serializeBulletRuns, stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import { guideQuestions, phraseQuestion } from "./guideCopy";
import type { ProfileSource } from "./provenance";
import type { ReviewItem } from "./types";

export { guideQuestions, phraseQuestion } from "./guideCopy";

export const guideCopy = {
  other: "Something else",
  replacement: "Your wording",
  number: "Number and context",
  numberHint: "e.g. time saved, % change, people, $",
  yes: "Yes, keep it",
  edit: "Edit it",
  options: "Choose an option",
} as const;

export interface ReviewGuide {
  question: string;
  answerType: "chips" | "number" | "confirm" | "none";
  buildChips: (item: ReviewItem, roleEvidence: string, profile: ProfileSource | null) => string[];
  /** Full suggested block; null for empty, unchanged or stale answers. */
  apply: (item: ReviewItem, blockText: string, answer: string) => string | null;
}

// Named tools elsewhere in a profile do not prove their use in this role. Only
// offer artefacts/stages literally present in the matching role's own evidence.
const ARTEFACTS = /\b(?:(?:dbt|SQL|Power BI|Tableau)\s+)?(?:models?|dashboards?|reports?|pipelines?|databases?|websites?|applications?|workshops?|audits?|budgets?|integrations?)\b/gi;
const STAGES = /\b(?:planning|design|development|testing|deployment|maintenance|reporting|requirements gathering|data modelling|data modeling)\b/gi;

function evidenceChips(evidence: string, pattern: RegExp): string[] {
  return [...new Set([...stripBulletMarkup(evidence).matchAll(pattern)].map((m) => m[0]))].slice(0, 3);
}

function matchesSpan(item: ReviewItem, blockText: string): boolean {
  return Number.isInteger(item.start) && Number.isInteger(item.end) && item.start >= 0 && item.end >= item.start &&
    item.end <= blockText.length && blockText.slice(item.start, item.end) === item.before;
}

function replaceSpan(item: ReviewItem, blockText: string, answer: string): string | null {
  const value = answer.trim();
  if (!stripBulletMarkup(value).trim() || value === stripBulletMarkup(item.before) || !matchesSpan(item, blockText)) return null;
  if (!item.before.includes("*") && !value.includes("*")) return blockText.slice(0, item.start) + value + blockText.slice(item.end);
  // Split phrases can cross formatting boundaries. Rebuild their runs so the
  // replacement inherits the first character's style and surrounding text keeps its own.
  const start = markedToPlainOffset(blockText, item.start);
  const end = markedToPlainOffset(blockText, item.end);
  let offset = 0;
  let inserted = false;
  return serializeBulletRuns(parseBulletMarkup(blockText).flatMap((run) => {
    const from = offset;
    const to = offset += run.text.length;
    if (to <= start || from >= end) return [run];
    const parts = [];
    if (start > from) parts.push({ ...run, text: run.text.slice(0, start - from) });
    if (!inserted) {
      parts.push(...parseBulletMarkup(value).map((answerRun) => ({ ...answerRun, bold: run.bold || answerRun.bold, italic: run.italic || answerRun.italic })));
      inserted = true;
    }
    if (end < to) parts.push({ ...run, text: run.text.slice(end - from) });
    return parts;
  }));
}

const noChips: ReviewGuide["buildChips"] = () => [];
const textGuide = (question: string, answerType: ReviewGuide["answerType"] = "none", buildChips = noChips): ReviewGuide => ({ question, answerType, buildChips, apply: replaceSpan });
const output = textGuide(guideQuestions.output, "chips", (_item, evidence) => evidenceChips(evidence, ARTEFACTS));
const scope = textGuide(guideQuestions.scope, "chips", (_item, evidence) => evidenceChips(evidence, STAGES));
const evidence = textGuide(guideQuestions.evidence);
const wording = textGuide(guideQuestions.wording);

// Dropping "was" reverses agency in "was trained" / "was assigned".
// The candidate supplies the action rather than having a responsibility inferred.
const action = textGuide(guideQuestions.action, "chips");
const confirm = textGuide(guideQuestions.confirm, "confirm");
const metric: ReviewGuide = {
  ...textGuide(guideQuestions.metric, "number"),
  apply(item, blockText, answer) {
    if (!/\d/.test(answer)) return null;
    // Missing metrics have no flagged words. Append only what the person typed,
    // without turning a bare number into an invented result or unit.
    if (!matchesSpan(item, blockText) || !answer.trim()) return null;
    return `${blockText.replace(/\s+$/, "")} (${answer.trim()})`;
  },
};

export const guideRegistry: Readonly<Record<string, ReviewGuide>> = {
  "style.passive": action,
  "style.weakOpener": action,
  "integrity.company-placeholder": textGuide("What is the employer’s name?"),
  "integrity.company-cutoff": textGuide("What is the employer’s name?"),
  "integrity.company-spelling": textGuide("Which employer name is correct?"),
  "integrity.dates-future": confirm,
  "integrity.many-current": confirm,
  "integrity.tense": confirm,
  "integrity.overclaim": confirm,
  "integrity.no-metrics": metric,
};

export function guideFor(item: ReviewItem): ReviewGuide | null {
  if (item.kind !== "fix" || item.after) return null;
  if (item.ruleId === "style.buzzword" || item.ruleId === "style.jobAd") {
    const question = phraseQuestion(stripBulletMarkup(item.before));
    return question === guideQuestions.output ? output : question === guideQuestions.scope ? scope : question === guideQuestions.evidence ? evidence : wording;
  }
  // Honesty flags intentionally aren't emitted by today's analyzer. Handle
  // existing flag-only cards without restoring that removed pipeline.
  if (item.ruleId.startsWith("factcheck.")) return confirm;
  return Object.prototype.hasOwnProperty.call(guideRegistry, item.ruleId) ? guideRegistry[item.ruleId] : null;
}

/** Adapt the full guide preview to the existing span-based Apply fix path. */
export function guidedItem(item: ReviewItem, blockText: string, answer: string): ReviewItem | null {
  const guide = guideFor(item);
  if (!guide || guide.answerType === "confirm") return null;
  // A leading sentinel records custom-input mode even while that input is empty.
  const text = guide.apply(item, blockText, answer.startsWith("\u0000") ? answer.slice(1) : answer);
  if (!text || text === blockText) return null;
  if (guide.answerType === "number" || item.before.includes("*") || answer.includes("*")) return { ...item, start: 0, end: blockText.length, before: blockText, after: text };
  const suffixLength = blockText.length - item.end;
  return { ...item, after: text.slice(item.start, text.length - suffixLength) };
}

export function reviewPriority(item: ReviewItem): number {
  if (item.severity === "verify" || item.ruleId.startsWith("factcheck.")) return 0;
  if (item.ruleId === "integrity.no-metrics") return 1;
  if (item.ruleId.startsWith("integrity.") && !/-(case|typo)$/.test(item.ruleId)) return 0;
  if (item.ruleId === "style.buzzword" || item.ruleId === "style.jobAd") return 2;
  return 3;
}
