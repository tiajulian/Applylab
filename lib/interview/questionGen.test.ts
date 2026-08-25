import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/anthropic/json";

describe("Interview Question Generation & JSON Parsing", () => {
  it("extracts clean JSON from raw Gemini code fences", () => {
    const rawFenced = `\`\`\`json
{
  "questions": [
    {
      "order_index": 1,
      "question_type": "motivation",
      "question_text": "Tell us about your background in software engineering.",
      "competency_focus": "Background"
    }
  ]
}
\`\`\``;

    const extracted = extractJson(rawFenced);
    const parsed = JSON.parse(extracted);
    expect(Array.isArray(parsed.questions)).toBe(true);
    expect(parsed.questions[0].order_index).toBe(1);
    expect(parsed.questions[0].question_type).toBe("motivation");
  });

  it("handles plain JSON without markdown blocks", () => {
    const rawPlain = JSON.stringify({
      questions: [
        {
          order_index: 1,
          question_type: "behavioural",
          question_text: "Describe a time you solved a production outage.",
          competency_focus: "Problem solving",
        },
      ],
    });

    const extracted = extractJson(rawPlain);
    const parsed = JSON.parse(extracted);
    expect(parsed.questions.length).toBe(1);
  });
});
