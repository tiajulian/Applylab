import { describe, it, expect } from "vitest";
import {
  decideFollowup,
  MAX_TOTAL_TURNS_PER_SESSION,
} from "./followup";

describe("Interview follow-up decision logic", () => {
  it("grants a valid follow-up on a main question when needed", () => {
    const decision = decideFollowup({
      isCurrentTurnFollowup: false,
      needsFollowup: true,
      followupQuestion: "Could you expand on what metrics improved after your refactor?",
      totalCompletedTurns: 2,
    });

    expect(decision.shouldFollowup).toBe(true);
    expect(decision.followupQuestionText).toBe("Could you expand on what metrics improved after your refactor?");
    expect(decision.reason).toBe("granted");
  });

  it("denies follow-up if current turn was already a follow-up (max 1 cap)", () => {
    const decision = decideFollowup({
      isCurrentTurnFollowup: true,
      needsFollowup: true,
      followupQuestion: "Another follow up?",
      totalCompletedTurns: 3,
    });

    expect(decision.shouldFollowup).toBe(false);
    expect(decision.followupQuestionText).toBeNull();
    expect(decision.reason).toBe("already_followup");
  });

  it("denies follow-up when not needed", () => {
    const decision = decideFollowup({
      isCurrentTurnFollowup: false,
      needsFollowup: false,
      followupQuestion: "Not needed question",
      totalCompletedTurns: 1,
    });

    expect(decision.shouldFollowup).toBe(false);
    expect(decision.reason).toBe("not_needed");
  });

  it("denies follow-up when question text is missing or empty", () => {
    const decision = decideFollowup({
      isCurrentTurnFollowup: false,
      needsFollowup: true,
      followupQuestion: "",
      totalCompletedTurns: 1,
    });

    expect(decision.shouldFollowup).toBe(false);
    expect(decision.reason).toBe("missing_question");
  });

  it("denies follow-up when session total turn limit is reached", () => {
    const decision = decideFollowup({
      isCurrentTurnFollowup: false,
      needsFollowup: true,
      followupQuestion: "What happened next?",
      totalCompletedTurns: MAX_TOTAL_TURNS_PER_SESSION,
    });

    expect(decision.shouldFollowup).toBe(false);
    expect(decision.reason).toBe("session_turn_cap_reached");
  });
});
