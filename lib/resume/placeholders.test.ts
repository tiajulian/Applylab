import { describe, expect, it } from "vitest";
import { fillInPlaceholders, hasFillInPlaceholder, placeholderExportError, resumePlaceholders } from "./placeholders";
import type { ResumeContent } from "@/types";

describe("fill-in placeholders", () => {
  it("finds [X]-style blanks in a suggested rewrite", () => {
    expect(fillInPlaceholders("Processed [X million rows/transactions] and closed [Y] cases")).toEqual([
      "[X million rows/transactions]",
      "[Y]",
    ]);
    expect(hasFillInPlaceholder("Cut processing time by 30%")).toBe(false);
    expect(hasFillInPlaceholder("Built models in Python [R]")).toBe(false);
  });

  it("lists blanks left anywhere a fix can write, for the export check", () => {
    const content = {
      summary: "Analyst with [N] years",
      experience: [{ bullets: ["Closed [Y] cases", "Built dashboards"] }],
      projects: [{ bullets: ["Shipped [insert feature]", "Built ETL in Python [Airflow] for [confidential client]"] }],
    } as unknown as ResumeContent;
    const found = resumePlaceholders(content);
    expect(found).toEqual(["[N]", "[Y]", "[insert feature]"]);
    expect(placeholderExportError(found)).toContain("[N], [Y], [insert feature]");
  });
});
