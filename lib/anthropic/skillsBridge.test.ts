import { describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/aiGateway/gateway", () => ({
  callGateway: async (p: { invoke: () => unknown }) => p.invoke(),
  openai: { chat: { completions: { create: (...args: unknown[]) => create(...args) } } },
}));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: async () => {} }));

import { analyzeSkillsBridge } from "./skillsBridge";

const base = {
  source_company: "Acme",
  source_job_title: "Analyst",
  source_snippet: "",
  competency: "Reporting",
  target_requirement: "Reporting",
  confidence: "medium",
};

describe("analyzeSkillsBridge", () => {
  it("caps and cleans suggested picks (which items offer them is decided after anchoring, in the route)", async () => {
    create.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              mode: "level_up",
              items: [
                { ...base, state: "to_confirm", suggested_tools: [" SQL ", "", "Excel", "Power BI", "Tableau", "Looker"], suggested_stakeholders: ["Finance team", "Ops", "Sales", "Leadership"] },
                { ...base, state: "matched", suggested_tools: ["SQL"], suggested_stakeholders: ["Finance team"] },
              ],
            }),
          },
        },
      ],
      usage: {},
    });
    const result = await analyzeSkillsBridge({ work_experience: [], skills: [] } as never, { jobTitle: "BI Analyst", companyName: "", jobDescription: "" }, "u1", {} as never, "pro");
    expect(result.items[0].suggested_tools).toEqual(["SQL", "Excel", "Power BI", "Tableau"]);
    expect(result.items[0].suggested_stakeholders).toEqual(["Finance team", "Ops", "Sales"]);
  });
});
