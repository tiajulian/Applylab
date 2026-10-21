import { describe, expect, it, vi } from "vitest";

const create = vi.fn();
vi.mock("@/lib/aiGateway/gateway", () => ({
  callGateway: async (p: { invoke: () => unknown }) => p.invoke(),
  openai: { chat: { completions: { create: (...args: unknown[]) => create(...args) } } },
}));
vi.mock("@/lib/anthropic/costLog", () => ({ logApiCost: async () => {} }));

import { suggestRoleDuties } from "./roleDuties";

const reply = (duties: unknown[]) => ({ choices: [{ message: { content: JSON.stringify({ duties }) } }], usage: {} });

describe("suggestRoleDuties", () => {
  it("keeps per-duty suggested tools and stakeholders, trimmed and capped", async () => {
    create.mockResolvedValue(
      reply([
        {
          duty_text: "Wrote SQL queries for team reports.",
          category: "Reporting",
          suggested_tools: [" SQL ", "Excel", "", "Power BI", "Tableau", "Looker"],
          suggested_stakeholders: ["Finance team", "Sales managers", "Ops", "Leadership"],
        },
      ])
    );
    const { duties } = await suggestRoleDuties({ jobTitle: "Data Analyst" }, "u1", {} as never, "pro");
    expect(duties[0].suggested_tools).toEqual(["SQL", "Excel", "Power BI", "Tableau"]);
    expect(duties[0].suggested_stakeholders).toEqual(["Finance team", "Sales managers", "Ops"]);
  });

  it("drops a malformed duty instead of passing it on to be saved and cached", async () => {
    create.mockResolvedValue(
      reply([
        { duty_text: null, category: "Reporting" },
        { duty_text: "   ", category: "Reporting" },
        { duty_text: "Wrote SQL queries.", category: 42 },
      ])
    );
    const { duties } = await suggestRoleDuties({ jobTitle: "Data Analyst" }, "u1", {} as never, "pro");
    expect(duties).toEqual([{ duty_text: "Wrote SQL queries.", category: "", suggested_tools: [], suggested_stakeholders: [] }]);
  });

  it("returns empty picks when the model leaves them out or sends junk", async () => {
    create.mockResolvedValue(
      reply([
        { duty_text: "Trained new staff.", category: "Team" },
        { duty_text: "Checked stock.", category: "Stock", suggested_tools: "Excel", suggested_stakeholders: [3, null] },
      ])
    );
    const { duties } = await suggestRoleDuties({ jobTitle: "Retail Assistant" }, "u1", {} as never, "pro");
    expect(duties.map((d) => [d.suggested_tools, d.suggested_stakeholders])).toEqual([
      [[], []],
      [[], []],
    ]);
  });
});
