import { describe, expect, it } from "vitest";
import nspell from "nspell";
import { buildKnownWords, checkSpelling } from "./spellcheck";
import type { ResumeContent } from "@/types";

// A tiny, deterministic fixture dictionary - not the real 554KB AU dictionary, so these tests
// don't depend on the vendored files or a network fetch. nspell's dic format requires a word-count
// header line before the words themselves.
function testChecker(words: string[]) {
  return nspell("SET UTF-8\n", `${words.length}\n${words.join("\n")}`);
}

const EMPTY_RESUME: ResumeContent = {
  contact: { name: "", phone: "", email: "", location: "", linkedin: "", work_rights: "" },
  target_titles: [],
  summary: "",
  skills: [],
  tools: [],
  experience: [],
  projects: [],
  education: [],
  referees: [],
};

describe("checkSpelling", () => {
  it("flags a misspelled word and returns a suggestion", () => {
    const checker = testChecker(["coordinated", "daily", "deliveries", "with", "the", "team"]);
    const results = checkSpelling("Coordinated daily delivries with the team.", checker, new Set());
    expect(results).toEqual([{ word: "delivries", suggestions: ["deliveries"] }]);
  });

  it("does not flag correctly spelled words", () => {
    const checker = testChecker(["coordinated", "daily", "deliveries", "the", "team", "with"]);
    const results = checkSpelling("Coordinated daily deliveries with the team.", checker, new Set());
    expect(results).toEqual([]);
  });

  it("skips ALL-CAPS acronyms and digit-containing tokens", () => {
    const checker = testChecker(["managed"]);
    const results = checkSpelling("Managed KPI reporting for Q3 initiatives.", checker, new Set());
    // "KPI" (all-caps) and "Q3" (contains a digit) are skipped; "reporting"/"for"/"initiatives"
    // would otherwise be flagged against this tiny dictionary, but that's exactly what we expect
    // it to catch - only assert the acronym/code tokens specifically never appear.
    expect(results.some((r) => r.word === "KPI")).toBe(false);
    expect(results.some((r) => r.word === "Q3")).toBe(false);
  });

  it("does not flag a word already established elsewhere in this resume (knownWords)", () => {
    const checker = testChecker(["managed"]);
    const knownWords = buildKnownWords({
      ...EMPTY_RESUME,
      experience: [
        {
          job_title: "Coordinator",
          company: "Salesforce",
          company_description: "",
          location: "",
          start_date: "",
          end_date: "",
          bullets: [],
        },
      ],
    });
    const results = checkSpelling("Managed the Salesforce rollout.", checker, knownWords);
    expect(results.some((r) => r.word.toLowerCase() === "salesforce")).toBe(false);
  });

  it("returns at most one entry per distinct misspelled word, case-insensitively", () => {
    const checker = testChecker(["the"]);
    const results = checkSpelling("Recieved feedback, then recieved more feedback.", checker, new Set());
    expect(results.filter((r) => r.word.toLowerCase() === "recieved")).toHaveLength(1);
  });

  it("never suggests inserting an em or en dash - the app has a zero-tolerance dash rule", () => {
    const checker = testChecker(["test"]);
    const results = checkSpelling("This is a mispelled tets.", checker, new Set());
    for (const result of results) {
      for (const suggestion of result.suggestions) {
        expect(suggestion).not.toMatch(/[—–]/);
      }
    }
  });
});

describe("buildKnownWords", () => {
  it("collects words from contact name, titles, skills, tools, experience, projects, education, referees", () => {
    const resume: ResumeContent = {
      ...EMPTY_RESUME,
      contact: { ...EMPTY_RESUME.contact, name: "Alexandra Nguyen" },
      target_titles: ["Growthhacker"],
      skills: ["Figma"],
      tools: ["Data analysis: Snowflake"],
      experience: [
        {
          job_title: "Growthhacker",
          company: "Canva",
          company_description: "",
          location: "",
          start_date: "",
          end_date: "",
          bullets: [],
        },
      ],
      projects: [{ title: "Zapier automation", context: "", year: "", bullets: [] }],
      education: [{ degree: "Bachelor", institution: "Xavier College", year: "", notes: "" }],
      referees: [{ name: "Priyanka Rao", title: "", organisation: "Atlassian", phone: "", email: "" }],
    };

    const known = buildKnownWords(resume);
    for (const word of [
      "alexandra", "nguyen", "growthhacker", "figma", "snowflake", "canva",
      "zapier", "xavier", "priyanka", "rao", "atlassian",
    ]) {
      expect(known.has(word)).toBe(true);
    }
  });

  it("returns an empty set for an empty resume", () => {
    expect(buildKnownWords(EMPTY_RESUME).size).toBe(0);
  });
});
