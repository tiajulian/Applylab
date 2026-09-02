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

  it("parses a structured technical assessment for coding questions", () => {
    const raw = JSON.stringify({
      transcript: "SELECT category, SUM(sale_amount) AS total_sales FROM transactions GROUP BY category ORDER BY total_sales DESC;",
      filler_count: 0,
      technical_assessment: {
        score: 9,
        score_label: "Strong Performance",
        correctness: "correct",
        correctness_label: "Correct",
        correctness_summary: "Your solution produces the expected result.",
        time_assessment: "Good pace",
        strengths: [
          "Correctly grouped transactions by category using GROUP BY",
          "Correctly used SUM(sale_amount) to calculate total sales",
          "Correctly ordered the aggregated results from highest to lowest",
        ],
        improvements: [
          "Explain your approach in 1-2 sentences before writing the query",
          "Be prepared to discuss NULL handling for transaction amounts if asked",
        ],
        coaching_advice: "Your SQL solution is correct. In a real interview, don't jump straight into writing the query. First, briefly explain your approach so the interviewer can follow your reasoning.",
        coach_note: "Your SQL solution is correct and concise. Your biggest opportunity is to verbalise your reasoning before writing the query.",
      },
      needs_followup: false,
      followup_question: null,
    });

    const result = parseScoreResponse(raw, "coaching", undefined, 62, false, "coding", "coding");
    expect(result.star_scores).toBeNull();
    expect(result.technical_assessment).toBeDefined();
    expect(result.technical_assessment?.score).toBe(9);
    expect(result.technical_assessment?.score_label).toBe("Strong Performance");
    expect(result.technical_assessment?.correctness).toBe("correct");
    expect(result.technical_assessment?.correctness_label).toBe("Correct");
    expect(result.technical_assessment?.strengths).toHaveLength(3);
    expect(result.technical_assessment?.strengths[0]).toContain("GROUP BY");
    expect(result.technical_assessment?.improvements).toHaveLength(2);
    expect(result.technical_assessment?.coaching_advice).toContain("SQL solution is correct");
    expect(result.technical_assessment?.coach_note).toContain("verbalise your reasoning");
    expect(result.filler_count).toBe(0);
  });

  it("clamps out-of-range technical assessment scores and maps partial/incorrect statuses", () => {
    const raw = JSON.stringify({
      transcript: "def two_sum(nums, target): return []",
      technical_assessment: {
        score: 15,
        correctness: "partially_correct",
        correctness_summary: "Incomplete implementation.",
        strengths: ["Defined function signature."],
        improvements: ["Implement hash map lookup."],
      },
    });

    const result = parseScoreResponse(raw, "coaching", undefined, 30, false, "coding", "coding");
    expect(result.technical_assessment?.score).toBe(10);
    expect(result.technical_assessment?.correctness).toBe("partially_correct");
    expect(result.technical_assessment?.correctness_label).toBe("Partially Correct");
  });

  it("falls back gracefully for coding stage when JSON is truncated", () => {
    const truncated = `{"transcript": "SELECT * FROM users`;
    const result = parseScoreResponse(truncated, "coaching", "SELECT * FROM users", 40, false, "coding", "coding");

    expect(result.star_scores).toBeNull();
    expect(result.technical_assessment).toBeDefined();
    expect(result.technical_assessment?.score).toBe(7);
    expect(result.technical_assessment?.correctness).toBe("partially_correct");
    expect(result.technical_assessment?.strengths.length).toBeGreaterThan(0);
    expect(result.technical_assessment?.improvements.length).toBeGreaterThan(0);
  });

  it("calibrates fallback score to low for empty/nonsense coding input on malformed JSON", () => {
    const malformed = `{"error": "bad response"`;
    const result = parseScoreResponse(malformed, "coaching", "bad", 5, false, "coding", "coding");

    expect(result.star_scores).toBeNull();
    expect(result.technical_assessment).toBeDefined();
    expect(result.technical_assessment?.score).toBe(2);
    expect(result.technical_assessment?.correctness).toBe("incorrect");
    expect(result.technical_assessment?.correctness_label).toBe("Incorrect");
    expect(result.technical_assessment?.score_label).toBe("Needs Improvement");
  });
});
