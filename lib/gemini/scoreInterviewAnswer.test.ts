import { describe, it, expect } from "vitest";
import { parseScoreResponse } from "./scoreInterviewAnswer";

describe("parseScoreResponse (defensive Gemini JSON parsing)", () => {
  it("parses a clean, markdown-fenced simulation response", () => {
    const raw = `\`\`\`json
{
  "transcript": "I led the migration and cut deploy time by 40%.",
  "filler_count": 2,
  "star_scores": { "situation": 4, "task": 4, "action": 5, "result": 4, "summary": "Strong result." },
  "content_feedback": "Clear and quantified.",
  "delivery_feedback": "Confident pace.",
  "suggested_answer": "I led the migration...",
  "needs_followup": false,
  "followup_question": null
}
\`\`\``;

    const result = parseScoreResponse(raw, "simulation", undefined, 45, true);
    expect(result.transcript).toContain("migration");
    expect(result.star_scores).toEqual({ situation: 4, task: 4, action: 5, result: 4, summary: "Strong result." });
    expect(result.needs_followup).toBe(false);
    expect(result.filler_count).toBe(2);
  });

  it("forces filler_count to 0 for a text answer even if the model returns a nonzero count", () => {
    // Regression test: gemini-3.5-flash-lite was observed doing exactly this in a side-by-side
    // comparison (returning filler_count: 5 for a typed answer, ignoring the "text input ->
    // filler_count 0" instruction) - see docs/interview-review.md.
    const raw = JSON.stringify({
      transcript: "Yeah so there was this one project, it was pretty challenging I guess.",
      filler_count: 5,
      star_scores: { situation: 2, task: 1, action: 1, result: 1, summary: "Vague." },
      content_feedback: "Too vague.",
      delivery_feedback: "Rambling.",
      suggested_answer: "...",
      needs_followup: true,
      followup_question: "Can you be more specific?",
    });

    const result = parseScoreResponse(raw, "simulation", undefined, 0, false);
    expect(result.filler_count).toBe(0);
  });

  it("never returns star_scores for a coaching-mode response, even if the model hallucinates one", () => {
    const raw = JSON.stringify({
      transcript: "I'd invite quieter voices before proposing my own idea.",
      filler_count: 0,
      star_scores: { situation: 5, task: 5, action: 5, result: 5 }, // model ignored the instruction not to include this
      content_feedback: "Good framing.",
      delivery_feedback: "Calm pace.",
      suggested_answer: "Building on that...",
      needs_followup: false,
      followup_question: null,
    });

    const result = parseScoreResponse(raw, "coaching", undefined, 30, false);
    expect(result.star_scores).toBeNull();
  });

  it("falls back to defaults without throwing on truncated/invalid JSON", () => {
    const truncated = `{"transcript": "I worked on the proj`;
    const result = parseScoreResponse(truncated, "simulation", "typed fallback answer", 0, false);

    expect(result.transcript).toBe("typed fallback answer");
    expect(result.star_scores).toEqual({
      situation: 3,
      task: 3,
      action: 3,
      result: 3,
      summary: "Completed answer evaluation.",
    });
    expect(result.filler_count).toBe(0);
    expect(result.needs_followup).toBe(false);
    expect(result.followup_question).toBeNull();
  });

  it("falls back to defaults without throwing on completely empty text", () => {
    const result = parseScoreResponse("", "simulation", undefined, 10, false);
    expect(result.transcript).toBe("");
    expect(result.content_feedback).toBe("Answer captured.");
  });

  it("clamps out-of-range star scores into 1-5 and coerces missing fields", () => {
    const raw = JSON.stringify({
      transcript: "Answer text",
      star_scores: { situation: 9, task: -3, action: "not a number", result: 2 },
    });

    const result = parseScoreResponse(raw, "simulation", undefined, 20, false);
    expect(result.star_scores).toEqual({
      situation: 5,
      task: 1,
      action: 3,
      result: 2,
      summary: "Completed answer evaluation.",
    });
  });

  it("handles a non-object JSON payload (e.g. a bare array) without throwing", () => {
    const raw = "[1, 2, 3]";
    const result = parseScoreResponse(raw, "simulation", "fallback text", 15, false);
    expect(result.transcript).toBe("fallback text");
    expect(result.star_scores?.situation).toBe(3);
  });
});
