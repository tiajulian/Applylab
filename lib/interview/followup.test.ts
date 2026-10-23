import { describe, it, expect } from "vitest";
import { decideFollowup, followUpAllowance, type FollowupDecisionInput } from "./followup";
import { STAGE_QUESTION_COUNT } from "./setupConstants";

function input(overrides: Partial<FollowupDecisionInput> = {}): FollowupDecisionInput {
  return {
    isCurrentTurnFollowup: false,
    needsFollowup: true,
    followupQuestion: "Could you expand on what changed after your refactor?",
    followupsSoFar: 0,
    questionCount: 8,
    ...overrides,
  };
}

describe("followUpAllowance", () => {
  it("is half the main questions, rounded up", () => {
    expect(followUpAllowance(8)).toBe(4);
    expect(followUpAllowance(5)).toBe(3);
    expect(followUpAllowance(10)).toBe(5);
    expect(followUpAllowance(0)).toBe(0);
  });

  it("gives every stage room for follow-ups on top of its card count", () => {
    for (const count of Object.values(STAGE_QUESTION_COUNT)) {
      expect(followUpAllowance(count)).toBeGreaterThan(0);
    }
  });
});

describe("decideFollowup", () => {
  it("grants a valid follow-up on a main question when needed", () => {
    const decision = decideFollowup(input());
    expect(decision.shouldFollowup).toBe(true);
    expect(decision.followupQuestionText).toBe("Could you expand on what changed after your refactor?");
    expect(decision.reason).toBe("granted");
  });

  it("denies a follow-up to a follow-up (max 1 per question)", () => {
    const decision = decideFollowup(input({ isCurrentTurnFollowup: true }));
    expect(decision.shouldFollowup).toBe(false);
    expect(decision.followupQuestionText).toBeNull();
    expect(decision.reason).toBe("already_followup");
  });

  it("denies when not needed", () => {
    expect(decideFollowup(input({ needsFollowup: false })).reason).toBe("not_needed");
  });

  it("denies when the question text is missing", () => {
    expect(decideFollowup(input({ followupQuestion: "" })).reason).toBe("missing_question");
  });

  it("stops at the session's follow-up allowance, not a flat turn cap", () => {
    expect(decideFollowup(input({ questionCount: 10, followupsSoFar: 4 })).shouldFollowup).toBe(true);
    expect(decideFollowup(input({ questionCount: 10, followupsSoFar: 5 })).reason).toBe("session_followup_cap_reached");
  });
});
