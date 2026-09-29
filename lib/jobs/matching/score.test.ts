import { describe, expect, it } from "vitest";
import {
  DEFAULT_WEIGHTS,
  matchedSkills,
  parseWeights,
  rankCandidates,
  scoreCandidate,
  titleSimilarity,
  toPercent,
  type Candidate,
  type ScoringProfile,
} from "@/lib/jobs/matching/score";
import { buildJobText, buildProfileText } from "@/lib/jobs/matching/text";

const NOW = Date.parse("2026-09-30T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();

function job(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "job-1",
    title: "Senior Frontend Developer",
    description_snippet: "Build React and TypeScript apps",
    salary_min: 110_000,
    salary_max: 130_000,
    salary_is_predicted: false,
    posted_at: daysAgo(2),
    distance: 0.2,
    ...overrides,
  };
}

const profile: ScoringProfile = {
  targetTitles: ["Backend Engineer", "Frontend Developer"],
  skills: ["React", "TypeScript", "GraphQL", "JS"],
  minSalary: 100_000,
};

describe("scoreCandidate", () => {
  it("combines the five weighted components", () => {
    const { score } = scoreCandidate(job(), profile, DEFAULT_WEIGHTS, NOW);
    const semantic = 0.8;
    const title = 0.8; // Dice: 2 shared words / (3 + 2)
    const skills = 2 / 4; // React, TypeScript
    const salary = 1;
    const recency = 1 - 2 / 30;
    expect(score).toBeCloseTo(0.55 * semantic + 0.2 * title + 0.1 * skills + 0.1 * salary + 0.05 * recency, 10);
  });

  it("is deterministic for fixed inputs", () => {
    expect(scoreCandidate(job(), profile, DEFAULT_WEIGHTS, NOW)).toEqual(scoreCandidate(job(), profile, DEFAULT_WEIGHTS, NOW));
  });

  it("builds reasons from the components", () => {
    expect(scoreCandidate(job(), profile, DEFAULT_WEIGHTS, NOW).reasons).toEqual([
      "Title matches Frontend Developer",
      "Mentions React, TypeScript",
      "Salary $110k–$130k meets your minimum",
      "Posted 2 days ago",
    ]);
  });

  it("labels a predicted salary as an estimate and scores it as unknown", () => {
    const predicted = job({ salary_is_predicted: true, posted_at: daysAgo(20) });
    const result = scoreCandidate(predicted, profile, DEFAULT_WEIGHTS, NOW);
    expect(result.reasons).toContain("Estimated salary $110k–$130k meets your minimum");
    const known = scoreCandidate(job({ posted_at: daysAgo(20) }), profile, DEFAULT_WEIGHTS, NOW);
    expect(known.score - result.score).toBeCloseTo(0.1 * (1 - 0.5), 10);
  });

  it("scores a salary below the minimum as 0 and gives no salary reason", () => {
    const low = job({ salary_min: 60_000, salary_max: 70_000 });
    const result = scoreCandidate(low, profile, DEFAULT_WEIGHTS, NOW);
    const base = scoreCandidate(job(), profile, DEFAULT_WEIGHTS, NOW);
    expect(base.score - result.score).toBeCloseTo(0.1, 10);
    expect(result.reasons.some((r) => r.includes("$"))).toBe(false);
  });

  it("drops recency to 0 at 30 days and handles a missing post date", () => {
    const old = scoreCandidate(job({ posted_at: daysAgo(45) }), profile, DEFAULT_WEIGHTS, NOW);
    const undated = scoreCandidate(job({ posted_at: null }), profile, DEFAULT_WEIGHTS, NOW);
    expect(old.score).toBeCloseTo(undated.score, 10);
    expect(old.reasons.some((r) => r.startsWith("Posted"))).toBe(false);
  });

  it("falls back to a similarity reason only for genuinely close jobs", () => {
    const vague = job({ title: "Office Coordinator", description_snippet: "", salary_min: null, salary_max: null, posted_at: daysAgo(20) });
    expect(scoreCandidate(vague, profile, DEFAULT_WEIGHTS, NOW).reasons).toEqual(["Similar to your profile"]);
    expect(scoreCandidate({ ...vague, distance: 0.55 }, profile, DEFAULT_WEIGHTS, NOW).reasons).toEqual([]);
  });

  it("claims a title match only when the whole target title is covered", () => {
    const mechanical = scoreCandidate(job({ title: "Mechanical Engineer" }), { ...profile, targetTitles: ["Software Engineer"] }, DEFAULT_WEIGHTS, NOW);
    expect(mechanical.reasons.some((r) => r.startsWith("Title matches"))).toBe(false);
    const lead = scoreCandidate(job({ title: "Lead Software Engineer, Payments" }), { ...profile, targetTitles: ["Software Engineer"] }, DEFAULT_WEIGHTS, NOW);
    expect(lead.reasons[0]).toBe("Title matches Software Engineer");
  });

  it("shows the salary without 'meets your minimum' when no minimum is set", () => {
    const result = scoreCandidate(job({ salary_min: 90_000, salary_max: 90_000 }), { ...profile, minSalary: null }, DEFAULT_WEIGHTS, NOW);
    expect(result.reasons).toContain("Salary $90k");
  });
});

describe("rankCandidates", () => {
  it("returns the top N highest first, breaking ties by id", () => {
    const ranked = rankCandidates(
      [job({ id: "b", distance: 0.5 }), job({ id: "a", distance: 0.5 }), job({ id: "c", distance: 0.1 })],
      profile,
      DEFAULT_WEIGHTS,
      NOW,
      2
    );
    expect(ranked.map((m) => m.jobId)).toEqual(["c", "a"]);
  });
});

describe("titleSimilarity", () => {
  it("ignores case, punctuation and stopwords", () => {
    expect(titleSimilarity("Head of Marketing", "marketing head")).toBe(1);
    expect(titleSimilarity("Nurse", "Chef")).toBe(0);
    expect(titleSimilarity("", "Chef")).toBe(0);
  });
});

describe("matchedSkills", () => {
  it("matches whole words case-insensitively, including symbol skills and synonyms", () => {
    const text = "Senior C# and C++ dev. Node.js, JavaScript, k8s. Reactive systems.";
    expect(matchedSkills(["c#", "C++", "Node", "JS", "Kubernetes", "React", "Java"], text)).toEqual([
      "c#",
      "C++",
      "Node",
      "JS",
      "Kubernetes",
    ]);
  });
});

describe("parseWeights", () => {
  it("parses five numbers and falls back on bad input", () => {
    expect(parseWeights("0.6,0.2,0.1,0.05,0.05")).toEqual({ semantic: 0.6, title: 0.2, skills: 0.1, salary: 0.05, recency: 0.05 });
    expect(parseWeights(undefined)).toBe(DEFAULT_WEIGHTS);
    expect(parseWeights("1,2,3")).toBe(DEFAULT_WEIGHTS);
    expect(parseWeights("1,2,3,4,-1")).toBe(DEFAULT_WEIGHTS);
  });
});

describe("embedding text", () => {
  it("builds the job and profile strings in the documented format", () => {
    expect(
      buildJobText({ title: "Chef", company: null, category_label: "Hospitality", location_display: "Perth", description_snippet: "Cook" })
    ).toBe("Chef\n\nHospitality\nPerth\nCook");
    expect(
      buildProfileText({ targetTitles: ["Chef"], skills: ["Pastry"], seniority: null, locations: ["Perth"], resumeText: `  ${"x".repeat(2500)}` })
    ).toBe(`Target roles: Chef\nSkills: Pastry\nSeniority: \nLocations: Perth\n${"x".repeat(2000)}`);
  });

  it("formats the percentage", () => {
    expect(toPercent(0.874)).toBe(87);
  });
});
