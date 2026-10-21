import { describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
const logApiCost = vi.fn(async () => {});
vi.mock("@/lib/aiGateway/gateway", () => ({
  callGateway: async (p: { invoke: () => unknown }) => p.invoke(),
  gemini: { models: { generateContent: (...args: unknown[]) => generateContent(...args) } },
  geminiOutputTokens: () => 0,
}));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: (...args: unknown[]) => logApiCost(...(args as [])) }));

import { MAX_PICK_LINES, normalizeLinePicks, suggestLinePicks } from "./suggestLinePicks";

const options = { userId: "u1", supabase: {} as never, tier: "pro" as const };

describe("normalizeLinePicks", () => {
  it("returns exactly one cleaned, capped entry per line, filling missing or junk entries with empty lists", () => {
    const raw = [
      { tools: [" SQL ", "", "Excel", "Power BI", "Tableau", "Looker"], stakeholders: ["Finance team"] },
      { tools: "Excel", stakeholders: [1, null] },
    ];
    expect(normalizeLinePicks(raw, 3)).toEqual([
      { tools: ["SQL", "Excel", "Power BI", "Tableau"], stakeholders: ["Finance team"] },
      { tools: [], stakeholders: [] },
      { tools: [], stakeholders: [] },
    ]);
  });

  it("treats a non-array reply as no picks", () => {
    expect(normalizeLinePicks({ tools: ["SQL"] }, 1)).toEqual([{ tools: [], stakeholders: [] }]);
  });
});

describe("suggestLinePicks", () => {
  it("makes no AI call for no lines", async () => {
    generateContent.mockReset();
    expect(await suggestLinePicks([], { jobTitle: "Analyst" }, options)).toEqual([]);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("asks about at most MAX_PICK_LINES lines and logs under its own feature, never 'assist'", async () => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({ text: JSON.stringify([{ tools: ["SQL"], stakeholders: [] }]) });
    const lines = Array.from({ length: MAX_PICK_LINES + 3 }, (_, i) => `Line ${i}`);
    const picks = await suggestLinePicks(lines, { jobTitle: "Analyst" }, options);
    expect(picks).toHaveLength(MAX_PICK_LINES);
    expect(picks[0]).toEqual({ tools: ["SQL"], stakeholders: [] });
    expect(String(generateContent.mock.calls[0][0].contents)).not.toContain(`Line ${MAX_PICK_LINES}`);
    expect(logApiCost).toHaveBeenCalledWith(expect.objectContaining({ feature: "line-picks" }));
  });
});
