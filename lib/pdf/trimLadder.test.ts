import { describe, expect, it } from "vitest";
import { applyTrim, buildTrimLadder } from "./trimLadder";
import { FONT_FLOOR_PT, SPACING_FLOOR_SCALE } from "@/lib/resume/templateDensity";
import type { ResumeContent } from "@/types";

function role(bulletCount: number): ResumeContent["experience"][number] {
  return {
    job_title: "Analyst",
    company: "Some Co",
    company_description: "",
    location: "Sydney, NSW",
    start_date: "2020",
    end_date: "2021",
    bullets: Array.from({ length: bulletCount }, (_, i) => `Bullet ${i + 1}`),
  };
}

function resumeWithRoles(bulletCounts: number[]): ResumeContent {
  return {
    contact: { name: "Jamie", phone: "0400 000 000", email: "jamie@example.com", location: "", linkedin: "", work_rights: "" },
    summary: Array.from({ length: 80 }, (_, i) => `word${i}`).join(" "),
    skills: ["Data analysis and querying: SQL, Python"],
    experience: bulletCounts.map(role),
    education: [{ degree: "BCom", institution: "University", year: "2018", notes: "" }],
    referees: [{ name: "Alex Manager", title: "Lead", organisation: "Some Co", phone: "0400", email: "alex@example.com" }],
  };
}

describe("buildTrimLadder", () => {
  it("starts at full density with nothing trimmed", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    expect(ladder[0]).toEqual({
      density: { fontPt: 10.5, spacingScale: 1, showRefereeLine: true },
      summaryWordBound: Number.POSITIVE_INFINITY,
      bulletDrop: [0, 0, 0, 0],
    });
  });

  it("drops the referee line before touching anything else", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    expect(ladder[1].density.showRefereeLine).toBe(false);
    expect(ladder[1].density.spacingScale).toBe(1);
    expect(ladder[1].bulletDrop).toEqual([0, 0, 0, 0]);
  });

  it("reduces spacing down to the floor after the referee line", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    const spacingSteps = ladder.map((s) => s.density.spacingScale);
    expect(spacingSteps).toContain(0.85);
    expect(spacingSteps).toContain(SPACING_FLOOR_SCALE);
    expect(Math.min(...spacingSteps)).toBe(SPACING_FLOOR_SCALE);
  });

  it("never drops bullets from the two most recent roles", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    for (const state of ladder) {
      expect(state.bulletDrop[0]).toBe(0);
      expect(state.bulletDrop[1]).toBe(0);
    }
  });

  it("trims older roles oldest-first down to a floor of 2 bullets", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    const last = ladder[ladder.length - 1];
    // role index 3 (oldest) started at 3 bullets, floor 2 -> at most 1 dropped in the main pass,
    // role index 2 started at 4 bullets, floor 2 -> up to 2 dropped, then the last-resort step
    // (step 6) targets the second-oldest role (index 2) for one more beyond that floor.
    expect(last.bulletDrop[3]).toBe(1);
    expect(last.bulletDrop[2]).toBe(3);
  });

  it("trims the summary toward the lower bound after bullet trimming", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    const bounds = ladder.map((s) => s.summaryWordBound);
    expect(bounds[0]).toBe(Number.POSITIVE_INFINITY);
    expect(bounds[bounds.length - 1]).toBe(45);
    // Once trimmed it never goes back up.
    const trimIndex = bounds.findIndex((b) => b === 45);
    expect(bounds.slice(trimIndex).every((b) => b === 45)).toBe(true);
  });

  it("reduces font in 0.5pt steps down to the floor, never below it", () => {
    const ladder = buildTrimLadder(resumeWithRoles([8, 5, 4, 3]));
    const fontSteps = ladder.map((s) => s.density.fontPt);
    expect(Math.min(...fontSteps)).toBe(FONT_FLOOR_PT);
    for (const font of fontSteps) {
      expect(font).toBeGreaterThanOrEqual(FONT_FLOOR_PT);
    }
  });

  it("treats both roles as recent (untrimmable) when there are only two roles total", () => {
    const ladder = buildTrimLadder(resumeWithRoles([6, 5]));
    for (const state of ladder) {
      expect(state.bulletDrop).toEqual([0, 0]);
    }
  });

  it("applies the last-resort drop to the single older role when there's only one", () => {
    const ladder = buildTrimLadder(resumeWithRoles([6, 5, 4]));
    const last = ladder[ladder.length - 1];
    // index 2 is the only older role -> floor 2 in the main pass, then one more in the last-resort step.
    expect(last.bulletDrop).toEqual([0, 0, 3]);
  });

  it("never overflows the ladder into negative bullet counts", () => {
    const ladder = buildTrimLadder(resumeWithRoles([6, 5, 2]));
    const last = ladder[ladder.length - 1];
    expect(last.bulletDrop[2]).toBeLessThanOrEqual(2);
  });
});

describe("applyTrim", () => {
  it("truncates the summary to the word bound", () => {
    const resume = resumeWithRoles([6, 5, 4, 3]);
    const trimmed = applyTrim(resume, {
      density: { fontPt: 10.5, spacingScale: 1, showRefereeLine: true },
      summaryWordBound: 5,
      bulletDrop: [0, 0, 0, 0],
    });
    expect(trimmed.summary.split(/\s+/)).toHaveLength(5);
  });

  it("leaves the summary untouched when under the word bound", () => {
    const resume = resumeWithRoles([6, 5, 4, 3]);
    const trimmed = applyTrim(resume, {
      density: { fontPt: 10.5, spacingScale: 1, showRefereeLine: true },
      summaryWordBound: Number.POSITIVE_INFINITY,
      bulletDrop: [0, 0, 0, 0],
    });
    expect(trimmed.summary).toBe(resume.summary);
  });

  it("slices bullets from the end according to bulletDrop", () => {
    const resume = resumeWithRoles([6, 5, 4, 3]);
    const trimmed = applyTrim(resume, {
      density: { fontPt: 10.5, spacingScale: 1, showRefereeLine: true },
      summaryWordBound: Number.POSITIVE_INFINITY,
      bulletDrop: [0, 0, 2, 1],
    });
    expect(trimmed.experience[2].bullets).toEqual(["Bullet 1", "Bullet 2"]);
    expect(trimmed.experience[3].bullets).toEqual(["Bullet 1", "Bullet 2"]);
    expect(trimmed.experience[0].bullets).toHaveLength(6);
  });
});
