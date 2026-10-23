import { describe, it, expect, vi, beforeEach } from "vitest";

const callGateway = vi.hoisted(() => vi.fn());
vi.mock("@/lib/aiGateway/gateway", () => ({ callGateway, openai: {} }));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: vi.fn() }));

import {
  generateInterviewQuestions,
  fallbackQuestions,
  normaliseQuestion,
  type GenerateQuestionsInput,
} from "./generateInterviewQuestions";
import { QuotaExceededError } from "@/lib/aiGateway/errors";
import { STAGE_QUESTION_COUNT } from "@/lib/interview/setupConstants";
import type { InterviewStageType } from "@/types";

function response(texts: string[]) {
  return {
    usage: { prompt_tokens: 1, completion_tokens: 1 },
    choices: [
      {
        message: {
          content: JSON.stringify({
            questions: texts.map((t, i) => ({
              order_index: i + 1,
              question_type: "behavioural",
              question_text: t,
              interviewer_persona: null,
              competency_focus: "x",
            })),
          }),
        },
      },
    ],
  };
}

const base = (questionCount: number, stageType: InterviewStageType = "panel"): GenerateQuestionsInput => ({
  userId: "u1",
  supabase: {} as never,
  tier: "pro",
  stageType,
  jobTitle: "Analyst",
  companyName: "Acme",
  profile: {},
  questionCount,
});

const qs = (n: number, prefix = "Tailored question") => Array.from({ length: n }, (_, i) => `${prefix} number ${i + 1}?`);

beforeEach(() => {
  callGateway.mockReset();
});

describe("generateInterviewQuestions", () => {
  it("returns exactly the requested count from one call when the model complies", async () => {
    callGateway.mockResolvedValueOnce(response(qs(10)));
    const out = await generateInterviewQuestions(base(10));
    expect(out.questions).toHaveLength(10);
    expect(out.usedFallback).toBe(false);
    expect(callGateway).toHaveBeenCalledTimes(1);
  });

  it("asks once more for the shortfall and dedupes the top-up", async () => {
    callGateway
      .mockResolvedValueOnce(response(qs(6)))
      .mockResolvedValueOnce(response(["Tailored question number 1?", ...qs(4, "Extra one")]));
    const out = await generateInterviewQuestions(base(10));
    expect(out.questions).toHaveLength(10);
    expect(out.usedFallback).toBe(false);
    expect(new Set(out.questions.map((q) => normaliseQuestion(q.question_text))).size).toBe(10);
    expect(out.questions.map((q) => q.order_index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("tops up from the generic set and flags it when still short", async () => {
    callGateway.mockResolvedValueOnce(response(qs(6))).mockResolvedValueOnce(response([]));
    const out = await generateInterviewQuestions(base(10));
    expect(out.questions).toHaveLength(10);
    expect(out.usedFallback).toBe(true);
  });

  it("falls back fully (and says so) when the provider errors", async () => {
    callGateway.mockRejectedValue(new Error("provider down"));
    const out = await generateInterviewQuestions(base(8, "general"));
    expect(out.questions).toHaveLength(8);
    expect(out.usedFallback).toBe(true);
  });

  it("lets a quota refusal through to the route instead of hiding it", async () => {
    callGateway.mockRejectedValue(new QuotaExceededError("pro", "interview-question-gen", null));
    await expect(generateInterviewQuestions(base(8, "general"))).rejects.toBeInstanceOf(QuotaExceededError);
  });
});

describe("fallbackQuestions", () => {
  it("can fill every stage on its own with no duplicates", () => {
    for (const [stageType, count] of Object.entries(STAGE_QUESTION_COUNT)) {
      const set = fallbackQuestions({ stageType: stageType as InterviewStageType, jobTitle: "Analyst", companyName: "Acme" });
      expect(set.length).toBeGreaterThanOrEqual(count);
      expect(new Set(set.map((q) => normaliseQuestion(q.question_text))).size).toBe(set.length);
    }
  });

  it("uses coding prompts for a coding round", () => {
    const set = fallbackQuestions({ stageType: "coding", jobTitle: "", companyName: "" });
    expect(set.every((q) => q.question_type === "coding")).toBe(true);
  });
});

describe("story hints", () => {
  it("keeps only evidence ids that exist in the profile, up to 3", async () => {
    const input = {
      ...base(1, "general"),
      profile: {
        work_experience: [
          { job_title: "Ops Lead", company: "Telstra", location: "", start_date: "", end_date: "", is_current: true, description: "Ran the support desk", wins: [] },
        ],
      },
    };
    const res = response(["Tell me about a time you fixed a process."]);
    const parsed = JSON.parse(res.choices[0].message.content);
    parsed.questions[0].suggested_evidence = ["role:0", "role:7", "made-up"];
    res.choices[0].message.content = JSON.stringify(parsed);
    callGateway.mockResolvedValueOnce(res);
    const out = await generateInterviewQuestions(input);
    expect(out.questions[0].suggested_evidence).toEqual([{ id: "role:0", label: "Ops Lead at Telstra", detail: "Ran the support desk" }]);
  });
});
