import { describe, it, expect } from "vitest";
import { CAREER_GOAL_OPTIONS } from "./GoalSelectionStep";
import { TARGET_ROLE_OPTIONS } from "./TargetRoleStep";
import { JOB_HUNT_PAIN_OPTIONS } from "./JobHuntPainStep";

describe("Onboarding Questions Definitions", () => {
  it("defines 6 career goal options covering major Australian job seeker goals", () => {
    expect(CAREER_GOAL_OPTIONS.length).toBe(6);
    const ids = CAREER_GOAL_OPTIONS.map((o) => o.id);
    expect(ids).toContain("career_transition");
    expect(ids).toContain("first_job");
    expect(ids).toContain("better_company");
    expect(ids).toContain("level_up_senior");
    expect(ids).toContain("break_into_tech");
    expect(ids).toContain("exploring");
  });

  it("defines 6 target role options covering primary Australian industry verticals", () => {
    expect(TARGET_ROLE_OPTIONS.length).toBe(6);
    const ids = TARGET_ROLE_OPTIONS.map((o) => o.id);
    expect(ids).toContain("tech");
    expect(ids).toContain("healthcare");
    expect(ids).toContain("finance_business");
    expect(ids).toContain("trades");
    expect(ids).toContain("retail_hospitality");
    expect(ids).toContain("other");
  });

  it("defines 4 core job hunt pain options", () => {
    expect(JOB_HUNT_PAIN_OPTIONS.length).toBe(4);
    const ids = JOB_HUNT_PAIN_OPTIONS.map((o) => o.id);
    expect(ids).toContain("writing_resumes");
    expect(ids).toContain("not_hearing_back");
    expect(ids).toContain("interviews");
    expect(ids).toContain("knowing_what_to_apply_for");
  });

  it("ensures every option has non-empty titles, icons, and subtexts", () => {
    const allOptions = [
      ...CAREER_GOAL_OPTIONS,
      ...TARGET_ROLE_OPTIONS,
      ...JOB_HUNT_PAIN_OPTIONS,
    ];
    for (const opt of allOptions) {
      expect(opt.title.trim().length).toBeGreaterThan(0);
      expect(opt.subtext.trim().length).toBeGreaterThan(0);
      expect(opt.icon.trim().length).toBeGreaterThan(0);
    }
  });
});
