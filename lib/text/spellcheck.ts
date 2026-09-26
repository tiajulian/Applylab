import type { ResumeContent } from "@/types";

export interface Misspelling {
  word: string;
  suggestions: string[];
}

// Fetched once and cached for the lifetime of the page - repeat calls (e.g. re-checking a field
// after every debounce tick) never re-fetch or re-parse the dictionary.
let cachedChecker: Promise<import("nspell")> | null = null;

/**
 * Loads a singleton AU-English spell checker, purely client-side and offline once loaded (no
 * AI/network cost per check, unlike the resume score - see ResumePreviewPane.tsx's live-estimate
 * comment for that same reasoning applied to scoring).
 *
 * The dictionary data is fetched as static files from public/dictionaries/en-au/ rather than
 * imported from the dictionary-en-au npm package directly: that package reads its .aff/.dic files
 * via Node's fs/promises at import time, which can't run in a browser bundle. The two files there
 * are vendored straight from dictionary-en-au@3.0.0 (see the README next to them for how to
 * refresh them) - the package stays a real dependency so that provenance is traceable, it's just
 * not the thing actually imported at runtime here.
 */
export function getSpellChecker(): Promise<import("nspell")> {
  if (!cachedChecker) {
    cachedChecker = (async () => {
      try {
        const [{ default: nspell }, affRes, dicRes] = await Promise.all([
          import("nspell"),
          fetch("/dictionaries/en-au/en-au.aff"),
          fetch("/dictionaries/en-au/en-au.dic"),
        ]);
        if (!affRes.ok || !dicRes.ok) throw new Error("Failed to fetch AU dictionary files");
        const [aff, dic] = await Promise.all([affRes.text(), dicRes.text()]);
        return nspell(aff, dic);
      } catch (err) {
        // Don't leave a rejected promise cached forever - a transient failure (e.g. one flaky
        // fetch) would otherwise permanently disable spellcheck for the rest of the session, with
        // every future field's check re-rejecting immediately instead of retrying.
        cachedChecker = null;
        throw err;
      }
    })();
  }
  return cachedChecker;
}

// A resume legitimately contains words no general dictionary will ever have - company names,
// product/tool names, acronyms - flagging those as "misspelled" would just be noise. Skipping
// ALL-CAPS and digit-containing tokens catches most acronyms/codes for free; buildKnownWords below
// catches the rest by trusting whatever the user's own resume already says about itself.
const ACRONYM_OR_CODE = /[A-Z]{2,}|\d/;

// Must start with a letter (so a bare number like "40" or "18%" is never treated as a word at
// all) but may contain digits after that (so "Q3", "COVID19" etc. survive as one token instead of
// being split down to a bare, dictionary-unrecognisable leading letter).
function tokenize(text: string): string[] {
  // A dotted run stays one token ("Node.js", "Next.js", "ASP.NET"): split apart it leaves fragments like "js".
  return text.match(/[A-Za-z][A-Za-z0-9'-]*(?:\.[A-Za-z0-9][A-Za-z0-9'-]*)*/g) ?? [];
}

// Everyday resume and tech words the en-AU dictionary lacks. Without them a plain "scalable" or "backend"
// gets flagged, which teaches people to ignore the highlights.
const RESUME_WORDS = new Set([
  "scalable", "scalability", "backend", "frontend", "microservice", "microservices", "roadmap", "roadmaps",
  "onboarding", "api", "apis", "config", "codebase", "serverless", "cybersecurity", "fintech", "saas",
  "upskill", "upskilled", "upskilling", "wellbeing",
]);

/**
 * Words this specific resume already establishes as real (company names, job titles, skills,
 * tools, institutions, the person's own name) - checked case-insensitively so a company name
 * mentioned in a bullet isn't flagged just because a general dictionary has never heard of it.
 */
export function buildKnownWords(resume: ResumeContent): Set<string> {
  const known = new Set<string>();
  const add = (text: string | undefined | null) => {
    if (!text) return;
    for (const word of tokenize(text)) known.add(word.toLowerCase());
  };

  add(resume.contact.name);
  for (const title of resume.target_titles) add(title);
  for (const skill of resume.skills) add(skill);
  for (const tool of resume.tools) add(tool);
  for (const entry of resume.experience) {
    add(entry.job_title);
    add(entry.company);
  }
  for (const project of resume.projects) add(project.title);
  for (const edu of resume.education) {
    add(edu.degree);
    add(edu.institution);
  }
  for (const referee of resume.referees) {
    add(referee.name);
    add(referee.organisation);
  }

  return known;
}

/**
 * Checks one field's text against the AU dictionary, skipping acronyms/codes and this resume's
 * own known words. Returns at most one Misspelling per distinct misspelled word (first occurrence
 * order), each with up to 3 suggestions - explicit accept/reject in the UI, never auto-corrected.
 */
export function checkSpelling(text: string, checker: import("nspell"), knownWords: Set<string>): Misspelling[] {
  const seen = new Set<string>();
  const results: Misspelling[] = [];

  const isOk = (word: string) =>
    ACRONYM_OR_CODE.test(word) || word.includes(".") || RESUME_WORDS.has(word.toLowerCase()) || knownWords.has(word.toLowerCase()) || checker.correct(word);

  for (const word of tokenize(text)) {
    const lower = word.toLowerCase();
    if (seen.has(lower)) continue;
    if (isOk(word)) continue;
    // A hyphenated compound ("large-scale", "cross-functional") is rarely a dictionary entry itself
    // but is fine when every part is a word - only flag it if some part isn't.
    if (word.includes("-") && word.split("-").filter(Boolean).every(isOk)) continue;

    seen.add(lower);
    results.push({ word, suggestions: checker.suggest(word).slice(0, 3) });
  }

  return results;
}
