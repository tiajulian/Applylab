import { describe, expect, it } from "vitest";
import nspell from "nspell";
import { findTextIssues, profileCheckInput, withJobAd } from "./preGenerateCheck";

// A tiny, deterministic dictionary (see spellcheck.test.ts for why it isn't the real en-AU one).
const checker = (() => {
  const words = [
    "coordinated", "the", "of", "parcels", "dispatch", "daily", "managed", "accounts", "team", "had", "that",
    "yesterday", "used", "tools", "deliveries", "with", "for", "and", "customers", "excel", "worked", "here", "reports",
  ];
  return nspell("SET UTF-8\n", `${words.length}\n${words.join("\n")}`);
})();

const check = (text: string, known: string[] = []) => findTextIssues([{ label: "Role", text }], checker, known);

describe("findTextIssues", () => {
  it("returns nothing for clean text and skips blank sources", () => {
    expect(check("Coordinated the dispatch of parcels daily.")).toEqual([]);
    expect(findTextIssues([{ label: "Empty", text: "   " }], checker)).toEqual([]);
  });

  it("flags a misspelling with a suggestion, under its source label", () => {
    const [result] = check("Coordinated daily delivries with the team.");

    expect(result.label).toBe("Role");
    expect(result.issues).toEqual([
      { kind: "spelling", text: "delivries", message: '"delivries" - did you mean deliveries?' },
    ]);
  });

  it("trusts capitalised names mid-sentence but still checks a sentence-initial unknown word", () => {
    expect(check("Managed Salesforce accounts for the team.")).toEqual([]);
    expect(check("Salesforce accounts managed daily.")[0].issues[0].text).toBe("Salesforce");
  });

  it("trusts camelCase brand names anywhere, including at the start of a sentence", () => {
    expect(check("eStar accounts managed daily.")).toEqual([]);
  });

  it("trusts words the user has vouched for, case-insensitively", () => {
    expect(check("Managed jira accounts for the team.", ["Jira"])).toEqual([]);
  });

  it("flags a repeated word, but not a legitimate double like 'had had'", () => {
    expect(check("Worked with the the team.")[0].issues).toEqual([
      { kind: "grammar", text: "the the", message: 'Repeated word: "the the"' },
    ]);
    expect(check("The team that that had had reports.")).toEqual([]);
  });

  it('flags a lone lowercase "i" once, and leaves "i.e." alone', () => {
    const [result] = check("Yesterday i managed the team.");
    expect(result.issues).toEqual([{ kind: "grammar", text: "i", message: 'Use a capital "I"' }]);

    expect(check("Used tools, i.e. Excel, daily.")).toEqual([]);
  });

  it("reports each source separately and drops the clean ones", () => {
    const results = findTextIssues(
      [
        { label: "Clean", text: "Coordinated the team." },
        { label: "Typo", text: "Managed accunts." },
      ],
      checker
    );

    expect(results.map((r) => r.label)).toEqual(["Typo"]);
  });
});

describe("profileCheckInput", () => {
  const profile = {
    fullName: "Sam Lee",
    skills: "Excel, Scheduling",
    tools: ["Jira"],
    experience: [
      { job_title: "Coordinator", company: "Acme", description: "Coordinated dispatch", wins: [{ text: "Cut errors" }, { text: "" }] },
      { job_title: "", company: "", description: "", wins: [] },
    ],
    education: [{ degree: "BComm", institution: "UNSW" }],
  };

  it("builds one labelled source per role from its description and wins", () => {
    const { sources } = profileCheckInput(profile);

    expect(sources).toEqual([
      { label: "Coordinator at Acme", text: "Coordinated dispatch\nCut errors" },
      { label: "Work experience", text: "" },
    ]);
  });

  it("collects the user's own names and terms as known words", () => {
    const { knownWords } = profileCheckInput(profile);

    expect(knownWords).toEqual(
      expect.arrayContaining(["Sam", "Lee", "Excel", "Scheduling", "Jira", "Coordinator", "Acme", "BComm", "UNSW"])
    );
  });

  it("adds the job ad as one more source", () => {
    const input = withJobAd(profileCheckInput(profile), "We want a coordinater");

    expect(input.sources.at(-1)).toEqual({ label: "Job ad", text: "We want a coordinater" });
  });
});
