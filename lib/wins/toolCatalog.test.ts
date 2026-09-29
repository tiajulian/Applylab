import { describe, expect, it } from "vitest";
import { TOOL_CATALOG, suggestTools } from "./toolCatalog";

describe("suggestTools", () => {
  it("suggests Snowflake-family tools from a partial name", () => {
    expect(suggestTools("sno", TOOL_CATALOG)[0]).toBe("Snowflake");
    expect(suggestTools("sno", TOOL_CATALOG)).toEqual(expect.arrayContaining(["Snowpark", "Snowsight"]));
  });

  it("tolerates small typos", () => {
    expect(suggestTools("snowflk", TOOL_CATALOG)).toContain("Snowflake");
    expect(suggestTools("salesfroce", TOOL_CATALOG)).toContain("Salesforce");
    expect(suggestTools("exel", TOOL_CATALOG)).toContain("Microsoft Excel");
  });

  it("matches a word inside the name", () => {
    expect(suggestTools("exc", TOOL_CATALOG)[0]).toBe("Microsoft Excel");
  });

  it("prefers the candidate's own spelling and skips selected tools", () => {
    expect(suggestTools("snow", ["snowflake", ...TOOL_CATALOG])[0]).toBe("snowflake");
    expect(suggestTools("snow", TOOL_CATALOG, ["Snowflake"])).not.toContain("Snowflake");
  });

  it("returns nothing for an empty query", () => {
    expect(suggestTools("  ", TOOL_CATALOG)).toEqual([]);
  });
});
