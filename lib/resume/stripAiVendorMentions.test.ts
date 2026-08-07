import { describe, expect, it } from "vitest";
import { stripAiVendorMentions } from "./stripAiVendorMentions";

describe("stripAiVendorMentions", () => {
  it("drops entries naming an AI vendor or assistant", () => {
    const result = stripAiVendorMentions([
      "Warehouse systems: SharePoint, Anthropic Claude, Excel",
      "AI tools: ChatGPT, Copilot",
      "Data analysis and querying: SQL, Python, R",
    ]);
    expect(result).toEqual(["Data analysis and querying: SQL, Python, R"]);
  });

  it("leaves ordinary tools and skills untouched", () => {
    const result = stripAiVendorMentions(["Stakeholder Reporting", "Order Processing", "SharePoint, Excel"]);
    expect(result).toEqual(["Stakeholder Reporting", "Order Processing", "SharePoint, Excel"]);
  });
});
