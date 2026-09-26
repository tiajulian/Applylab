import { checkSpelling } from "@/lib/text/spellcheck";

/** One block of user-facing text to check, with the label the warning shows it under. */
export interface CheckSource {
  label: string;
  text: string;
}

export interface TextIssue {
  kind: "spelling" | "grammar";
  /** The word or phrase as written. */
  text: string;
  message: string;
}

export interface SourceIssues {
  label: string;
  issues: TextIssue[];
}

const WORD = /[A-Za-z][A-Za-z0-9'-]*/g;
// Text before a word that means the word starts a sentence or a list item.
const SENTENCE_START = /(^|[.!?:\n•*-]\s*)$/;
// Deliberate doubles in ordinary English ("had had", "that that").
const LEGIT_REPEATS = new Set(["had", "that"]);

/**
 * Words that are almost always names or tools no dictionary knows, so they are trusted rather than
 * flagged: capitalised words in the middle of a sentence (Salesforce, Woolworths) and camelCase
 * brands (eStar, iPhone). A sentence-initial capital tells us nothing, so those still get checked.
 */
function likelyNames(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(WORD)) {
    const word = match[0];
    const isCamelCase = /[a-z][A-Z]/.test(word);
    const isMidSentenceCapital = /^[A-Z]/.test(word) && !SENTENCE_START.test(text.slice(0, match.index));
    if (isCamelCase || isMidSentenceCapital) found.push(word.toLowerCase());
  }
  return found;
}

/** Cheap, deterministic grammar slips with almost no false positives. Not a full grammar check. */
function findGrammarIssues(text: string): TextIssue[] {
  const issues: TextIssue[] = [];

  for (const match of text.matchAll(/\b([A-Za-z']+)\s+\1\b/gi)) {
    if (LEGIT_REPEATS.has(match[1].toLowerCase())) continue;
    issues.push({ kind: "grammar", text: match[0], message: `Repeated word: "${match[0]}"` });
  }

  // A lone lowercase "i" (but not "i.e.", "i)" or a list marker).
  if (/(?<![A-Za-z0-9'’.-])i(?![A-Za-z0-9'’.)-])/.test(text)) {
    issues.push({ kind: "grammar", text: "i", message: 'Use a capital "I"' });
  }

  return issues;
}

function spellingMessage(word: string, suggestions: string[]): string {
  return suggestions.length > 0 ? `"${word}" - did you mean ${suggestions.join(", ")}?` : `"${word}" may be misspelled`;
}

/**
 * Checks each source for en-AU spelling and basic grammar slips. `knownWords` are terms the user has
 * already established as real (their name, job titles, employers, skills, tools) and are never flagged.
 * Sources with no issues are dropped. Warn-only: nothing here edits or blocks anything.
 */
export function findTextIssues(
  sources: CheckSource[],
  checker: import("nspell"),
  knownWords: Iterable<string> = []
): SourceIssues[] {
  const known = new Set(Array.from(knownWords, (word) => word.toLowerCase()));
  const results: SourceIssues[] = [];

  for (const { label, text } of sources) {
    if (!text.trim()) continue;

    const knownHere = new Set([...known, ...likelyNames(text)]);
    const issues: TextIssue[] = [
      // A lone "i" is reported once, by the grammar check below, not also as a misspelling.
      ...checkSpelling(text, checker, knownHere)
        .filter(({ word }) => word.toLowerCase() !== "i")
        .map(
          ({ word, suggestions }): TextIssue => ({ kind: "spelling", text: word, message: spellingMessage(word, suggestions) })
        ),
      ...findGrammarIssues(text),
    ];

    if (issues.length > 0) results.push({ label, issues });
  }

  return results;
}

/** Everything the warning needs to check: the text blocks, plus terms the user has vouched for. */
export interface CheckInput {
  sources: CheckSource[];
  knownWords: string[];
}

interface CheckableProfile {
  fullName: string;
  /** Comma-separated, as the profile form holds it. */
  skills: string;
  tools: string[];
  experience: Array<{ job_title: string; company: string; description: string; wins: Array<{ text: string }> }>;
  education: Array<{ degree: string; institution: string }>;
}

/**
 * The profile text a resume is built from, one source per role, plus the user's own names and terms
 * (skills and tools count as vouched-for, so they are trusted rather than checked).
 */
export function profileCheckInput(profile: CheckableProfile): CheckInput {
  const sources = profile.experience.map((role) => ({
    label: [role.job_title, role.company].filter((part) => part.trim()).join(" at ") || "Work experience",
    text: [role.description, ...role.wins.map((win) => win.text)].filter((part) => part.trim()).join("\n"),
  }));

  const terms = [
    profile.fullName,
    profile.skills,
    ...profile.tools,
    ...profile.experience.flatMap((role) => [role.job_title, role.company]),
    ...profile.education.flatMap((edu) => [edu.degree, edu.institution]),
  ];
  const knownWords = terms.flatMap((term) => term.match(WORD) ?? []);

  return { sources, knownWords };
}

/** The same input with the pasted job ad added as one more source. A blank ad adds nothing. */
export function withJobAd(input: CheckInput, jobDescription: string): CheckInput {
  return { ...input, sources: [...input.sources, { label: "Job ad", text: jobDescription }] };
}
