import { describe, expect, it } from "vitest";
import { confirmedSkillEvidence, skillGapRole } from "./reviewSkillGap";
import type { ResumeContent, SkillsBridgeItem } from "@/types";

const item = { source_company: "Acme", source_job_title: "Analyst", state: "to_confirm", user_state: "confirmed", user_note: "Trained new starters.", competency: "Did you train staff?", source_snippet: "Training" } as SkillsBridgeItem;
const role = { company: "Acme", job_title: "Analyst" };
const content = { experience: [role] } as ResumeContent;
describe("review Skill Gap evidence", () => {
  it("never uses questions, gaps or rejected answers as resume wording", () => {
    expect(confirmedSkillEvidence(item)).toBe("Trained new starters.");
    expect(confirmedSkillEvidence({ ...item, user_note: null })).toBeNull();
    expect(confirmedSkillEvidence({ ...item, state: "gap" })).toBeNull();
    expect(confirmedSkillEvidence({ ...item, user_state: "rejected" })).toBeNull();
    expect(confirmedSkillEvidence({ ...item, state: "matched", user_note: null })).toBe("Training");
  });
  it("requires a unique role with the same employer and title", () => {
    expect(skillGapRole(content, item)).toBe(0);
    expect(skillGapRole(content, { ...item, source_company: "Other" })).toBeNull();
    expect(skillGapRole({ ...content, experience: [role, role] } as ResumeContent, item)).toBeNull();
  });
});
