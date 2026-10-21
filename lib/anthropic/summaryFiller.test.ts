import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const logApiCost = vi.fn(async () => {});
// Plain flag rather than a throwing vi.fn: Vitest reports an error thrown inside a vi.fn as a test
// failure even when the code under test catches it.
let providerDown = false;
vi.mock("@/lib/aiGateway/gateway", () => ({
  callGateway: async (p: { invoke: () => unknown }) => p.invoke(),
  gemini: {
    models: {
      generateContent: (...args: unknown[]) => {
        if (providerDown) throw new Error("provider down");
        return generateContent(...args);
      },
    },
  },
  geminiOutputTokens: () => 0,
}));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: (...args: unknown[]) => logApiCost(...(args as [])) }));

import { cleanSummaryFiller, dropFillerSentences, findSummaryFiller, isCleanRewrite } from "./summaryFiller";

const FILLER_SUMMARY =
  "Analytics Engineer with 3 years in SQL and dbt across media. Proven track record delivering actionable insights.";
const CLEAN = "Analytics Engineer with 3 years in SQL and dbt across media.";
const run = (summary: string, protectedTerms: string[] = []) =>
  cleanSummaryFiller(summary, { userId: "u1", supabase: {} as never, tier: "pro", protectedTerms });

describe("findSummaryFiller", () => {
  it("finds filler phrases case-insensitively", () => {
    expect(findSummaryFiller(FILLER_SUMMARY)).toEqual(["Proven track record", "actionable insights"]);
  });

  it("doesn't treat a bare 'Solutions' title or employer as filler", () => {
    expect(findSummaryFiller("Solutions Architect at Acme Solutions with 6 years in AWS.")).toEqual([]);
    expect(findSummaryFiller("Builds reliable data solutions.")).toEqual(["data solutions"]);
  });

  it("ignores a match that sits inside the candidate's own title, employer, or confirmed competency", () => {
    const summary = "Business Solutions Analyst at Digital Solutions Pty, skilled in cross-functional stakeholder management.";
    expect(findSummaryFiller(summary)).toEqual(["cross-functional stakeholder", "Business Solutions", "Digital Solutions"]);
    expect(
      findSummaryFiller(summary, ["Business Solutions Analyst", "Digital Solutions Pty", "Cross-functional stakeholder management"])
    ).toEqual([]);
  });

  it("still catches a filler occurrence elsewhere when the same phrase is also in a protected title", () => {
    expect(
      findSummaryFiller("Business Solutions Analyst who delivers business solutions to clients.", ["Business Solutions Analyst"])
    ).toEqual(["business solutions"]);
  });

  it("finds nothing in a plain summary", () => {
    expect(findSummaryFiller("Data Analyst skilled in SQL and Excel, working in retail.")).toEqual([]);
  });
});

describe("dropFillerSentences", () => {
  it("drops only the sentences carrying filler", () => {
    expect(dropFillerSentences(FILLER_SUMMARY)).toBe(CLEAN);
  });

  it("never splits decimals, dotted tool names, or abbreviations", () => {
    expect(dropFillerSentences("Developer with 2.5 years in Node.js and .NET. Proven track record of APIs.")).toBe(
      "Developer with 2.5 years in Node.js and .NET."
    );
    expect(dropFillerSentences("Analyst using tools e.g. Excel and SQL in U.S. Retail. Results-driven.")).toBe(
      "Analyst using tools e.g. Excel and SQL in U.S. Retail."
    );
  });

  it("splits after a single-letter tool and before a lowercase-led sentence", () => {
    expect(dropFillerSentences("Data Scientist skilled in Python and R. Proven track record of insights.")).toBe(
      "Data Scientist skilled in Python and R."
    );
    expect(dropFillerSentences("Analyst skilled in SQL. dbt user who leverages models. Works in retail.")).toBe(
      "Analyst skilled in SQL. Works in retail."
    );
  });

  it("always keeps the first sentence, the candidate's identity line", () => {
    expect(dropFillerSentences("Data Analyst with 5 years in SQL delivering actionable insights. Works in retail.")).toBe(
      "Data Analyst with 5 years in SQL delivering actionable insights. Works in retail."
    );
    expect(dropFillerSentences("Delivers scalable solutions.")).toBe("Delivers scalable solutions.");
  });
});

describe("isCleanRewrite", () => {
  it("rejects a rewrite that adds a number", () => {
    expect(isCleanRewrite(FILLER_SUMMARY, "Analytics Engineer with 3 years in SQL, dbt across 5 media teams.")).toBe(false);
  });

  it("rejects any new word, capitalised or not, even as a sentence's first word", () => {
    expect(isCleanRewrite(FILLER_SUMMARY, "Analytics Engineer with 3 years in SQL and pandas across media.")).toBe(false);
    expect(isCleanRewrite(FILLER_SUMMARY, "Python engineer with 3 years in SQL and dbt across media.")).toBe(false);
  });

  it("rejects a rewrite that drops facts: a number, a named tool, or most of the text", () => {
    expect(isCleanRewrite(FILLER_SUMMARY, "Analytics Engineer.")).toBe(false);
    expect(isCleanRewrite(FILLER_SUMMARY, "Analytics Engineer with years in SQL and dbt across media.")).toBe(false);
    expect(isCleanRewrite(FILLER_SUMMARY, "Analytics Engineer with 3 years in data and dbt across media.")).toBe(false);
  });

  it("rejects filler, an empty result, or a preamble", () => {
    expect(isCleanRewrite(FILLER_SUMMARY, "Builds data solutions.")).toBe(false);
    expect(isCleanRewrite(FILLER_SUMMARY, "  ")).toBe(false);
    expect(isCleanRewrite(FILLER_SUMMARY, "Here is the summary: Analytics Engineer with 3 years in SQL.")).toBe(false);
  });

  it("accepts a deletion-style rewrite, including a number that moved off a sentence end", () => {
    expect(isCleanRewrite(FILLER_SUMMARY, CLEAN)).toBe(true);
    expect(isCleanRewrite("Analyst since 2019. Proven track record.", "Analyst since 2019, with a track record.")).toBe(true);
  });
});

describe("cleanSummaryFiller", () => {
  beforeEach(() => {
    generateContent.mockReset();
    logApiCost.mockClear();
    providerDown = false;
  });

  it("makes no AI call when the summary has no filler", async () => {
    expect(await run("Data Analyst skilled in SQL.")).toBe("Data Analyst skilled in SQL.");
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("makes no AI call when the only match is the candidate's own title", async () => {
    expect(await run("Business Solutions Analyst skilled in SAP.", ["Business Solutions Analyst"])).toBe(
      "Business Solutions Analyst skilled in SAP."
    );
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("uses a clean AI rewrite and logs its cost under its own feature, never 'assist'", async () => {
    generateContent.mockResolvedValue({ text: CLEAN });
    expect(await run(FILLER_SUMMARY)).toBe(CLEAN);
    expect(logApiCost).toHaveBeenCalledWith(expect.objectContaining({ feature: "summary-cleanup" }));
  });

  it("falls back to dropping filler sentences when the rewrite invents something", async () => {
    generateContent.mockResolvedValue({ text: "Analytics Engineer who built 40 dbt models." });
    expect(await run(FILLER_SUMMARY)).toBe(CLEAN);
  });

  it("falls back when the AI call throws, never failing generation", async () => {
    providerDown = true;
    expect(await run(FILLER_SUMMARY)).toBe(CLEAN);
  });

  it("falls back when the AI call is too slow, without leaving a rejection unhandled", async () => {
    vi.useFakeTimers();
    try {
      let rejectLate: (e: Error) => void = () => {};
      generateContent.mockReturnValue(new Promise((_, reject) => (rejectLate = reject)));
      const pending = run(FILLER_SUMMARY);
      await vi.advanceTimersByTimeAsync(8_000);
      expect(await pending).toBe(CLEAN);
      rejectLate(new Error("late failure"));
      await vi.advanceTimersByTimeAsync(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
