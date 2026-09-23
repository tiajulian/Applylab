import { describe, expect, it } from "vitest";
import { analyzeResume, brevityScore, completenessScore, suggestBulletChips } from "./contentChecks";
import type { ResumeContent } from "@/types";

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

const WEAK_RESUME: ResumeContent = {
  ...EMPTY_RESUME,
  contact: { ...EMPTY_RESUME.contact, name: "Jamie Citizen" },
  summary: "Team player and hard worker.",
  skills: ["Excel"],
  experience: [
    {
      job_title: "Assistant",
      company: "Some Company",
      company_description: "",
      location: "",
      start_date: "2020",
      end_date: "2021",
      bullets: [
        "Was responsible for various tasks that were assigned by the manager on a daily basis.",
        "Team player who is a hard worker.",
      ],
    },
  ],
  education: [],
  referees: [],
};

const STRONG_RESUME: ResumeContent = {
  contact: { name: "Jamie Citizen", phone: "0400 000 000", email: "jamie@example.com", location: "Parramatta, NSW", linkedin: "", work_rights: "Australian citizen" },
  target_titles: ["Business Analyst", "Data Analyst"],
  summary: "Results-driven Business Analyst with 3+ years of experience in retail data analysis.",
  skills: ["SQL", "Excel", "Stakeholder Management"],
  tools: ["Data analysis and querying: SQL, Excel"],
  projects: [],
  experience: [
    {
      job_title: "Business Analyst",
      company: "Woolworths Group",
      company_description: "",
      location: "Sydney, NSW",
      start_date: "2022",
      end_date: "Present",
      bullets: [
        "Led process improvement initiatives that cut reporting time by 30%.",
        "Developed dashboards used by 15 regional managers to track weekly KPIs.",
        "Increased data accuracy by 20% through automated validation checks.",
      ],
    },
  ],
  education: [{ degree: "Bachelor of Commerce", institution: "University of Melbourne", year: "2018", notes: "" }],
  referees: [
    { name: "Alex Manager", title: "Team Lead", organisation: "Woolworths Group", phone: "0400 111 111", email: "alex@example.com" },
    { name: "Sam Boss", title: "Manager", organisation: "Coles", phone: "0400 222 222", email: "sam@example.com" },
  ],
};

describe("analyzeResume", () => {
  it("returns zeroed findings for an empty resume", () => {
    const findings = analyzeResume(EMPTY_RESUME);
    expect(findings.totalBullets).toBe(0);
    expect(findings.strongVerbPct).toBe(0);
    expect(findings.metricPct).toBe(0);
    expect(findings.hasSummary).toBe(false);
    expect(findings.passiveVoiceBullets).toEqual([]);
    expect(findings.buzzwordBullets).toEqual([]);
  });

  it("flags passive voice and buzzwords in a weak resume", () => {
    const findings = analyzeResume(WEAK_RESUME);
    expect(findings.totalBullets).toBe(2);
    expect(findings.passiveVoiceBullets.length).toBeGreaterThan(0);
    expect(findings.buzzwordBullets.length).toBeGreaterThan(0);
    expect(findings.strongVerbPct).toBe(0);
  });

  it("detects strong verbs and metrics in a strong resume", () => {
    const findings = analyzeResume(STRONG_RESUME);
    expect(findings.totalBullets).toBe(3);
    expect(findings.strongVerbPct).toBe(100);
    expect(findings.metricPct).toBe(100);
    expect(findings.hasSummary).toBe(true);
    expect(findings.passiveVoiceBullets).toEqual([]);
    expect(findings.buzzwordBullets).toEqual([]);
  });

  it("still detects a strong verb, buzzword, and passive voice when bold/italic markers (lib/resume/bulletMarkup.ts) land inside them", () => {
    const resume: ResumeContent = {
      ...EMPTY_RESUME,
      experience: [
        {
          ...STRONG_RESUME.experience[0],
          bullets: ["**Led** a **team player** effort that *was* **delivered** early."],
        },
      ],
    };
    const findings = analyzeResume(resume);
    // "Led" starting bolded must still count as a strong verb, not silently drop strongVerbPct.
    expect(findings.strongVerbPct).toBe(100);
    expect(findings.buzzwordBullets).toHaveLength(1);
    expect(findings.passiveVoiceBullets).toHaveLength(1);
    // Findings store plain text (for user-facing display in scoreReview.ts/qualityGate.ts) - no
    // literal "**"/"*" leaking into what the person sees.
    expect(findings.buzzwordBullets[0].bullet).not.toContain("*");
    expect(findings.passiveVoiceBullets[0]).not.toContain("*");
  });
});

describe("brevityScore", () => {
  it("scores an empty resume as 0", () => {
    expect(brevityScore(analyzeResume(EMPTY_RESUME))).toBe(0);
  });

  it("scores a resume with well-sized bullets highly", () => {
    expect(brevityScore(analyzeResume(STRONG_RESUME))).toBeGreaterThanOrEqual(80);
  });
});

describe("suggestBulletChips", () => {
  it("suggests adding a number when the bullet has no metric", () => {
    const chips = suggestBulletChips("Led cross-functional initiatives to streamline onboarding processes.");
    expect(chips[0]).toEqual({ action: "quantify", label: "Add a metric" });
  });

  it("suggests cutting a buzzword when one is present but a metric already exists", () => {
    const chips = suggestBulletChips("Delivered 10 projects and was seen as a team player.");
    expect(chips).toContainEqual({ action: "rewrite", label: "Cut the fluff" });
    expect(chips.some((c) => c.action === "quantify")).toBe(false);
  });

  it("suggests sharpening when the bullet doesn't open with a strong verb, even with a metric present", () => {
    const chips = suggestBulletChips("Reports were completed on 15 occasions each quarter.");
    expect(chips).toContainEqual({ action: "rewrite", label: "Sharpen this line" });
    expect(chips.some((c) => c.action === "quantify")).toBe(false);
  });

  it("suggests shortening an overlong bullet that is otherwise strong", () => {
    const longBullet = "Led team of 5 " + "word ".repeat(30).trim();
    expect(longBullet.trim().split(/\s+/).length).toBeGreaterThan(30);
    const chips = suggestBulletChips(longBullet);
    expect(chips).toContainEqual({ action: "shorten", label: "Tighten this up" });
  });

  it("deduplicates by action - a buzzword AND a weak opening both map to rewrite, so only one rewrite chip appears", () => {
    const chips = suggestBulletChips("Team player who is a hard worker.");
    const rewriteChips = chips.filter((c) => c.action === "rewrite");
    expect(rewriteChips).toHaveLength(1);
    expect(rewriteChips[0].label).toBe("Cut the fluff"); // buzzword is checked before the weak-opening fallback
  });

  it("falls back to exactly two generic chips for an already-strong bullet", () => {
    const chips = suggestBulletChips("Led process improvement initiatives that cut reporting time by 30%.");
    expect(chips).toEqual([
      { action: "senior", label: "Sound more senior" },
      { action: "rewrite", label: "How would a recruiter read this?" },
    ]);
  });

  it("never returns more than 3 chips", () => {
    const chips = suggestBulletChips("Team player who is a hard worker with a proven track record.");
    expect(chips.length).toBeLessThanOrEqual(3);
  });
});

describe("completenessScore", () => {
  it("scores an empty resume as 0", () => {
    expect(completenessScore(EMPTY_RESUME, analyzeResume(EMPTY_RESUME))).toBe(0);
  });

  it("scores a partial resume between 0 and 100", () => {
    const score = completenessScore(WEAK_RESUME, analyzeResume(WEAK_RESUME));
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it("scores a fully filled-out resume as 100", () => {
    expect(completenessScore(STRONG_RESUME, analyzeResume(STRONG_RESUME))).toBe(100);
  });
});
