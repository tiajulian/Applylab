import { describe, expect, it } from "vitest";
import { parseBulletMarkup, plainToMarkedOffset, serializeBulletRuns, stripBulletMarkup } from "@/lib/resume/bulletMarkup";
import { wordingItems } from "./rules";
import { guideFor, guideRegistry, guidedItem, reviewPriority } from "./guides";
import { buildComparison } from "./diff";
import type { ReviewItem } from "./types";

const item = (ruleId: string, before: string, start = 0): ReviewItem => ({
  id: "i", resumeId: "r", kind: "fix", ruleId, severity: "info", blockId: "experienceBullet:0:0",
  start, end: start + before.length, before, after: "", reason: "Original reason", status: "open",
});

describe("guided review registry", () => {
  it("only offers up to three artefacts present in this role, with no padded tools", () => {
    const i = item("style.jobAd", "technical solutions");
    const guide = guideFor(i)!;
    const source = "Built dbt models, dashboards, reports and pipelines.";
    expect(guide.buildChips(i, source, null)).toEqual(["dbt models", "dashboards", "reports"]);
    expect(guide.buildChips(i, "Worked with clients", null)).toEqual([]);
    expect(guide.buildChips(i, "Built dashboards", null)).not.toContain("Tableau dashboards");
    for (const g of Object.values(guideRegistry)) expect(g.buildChips(i, source, null).length).toBeLessThanOrEqual(3);
  });

  it("offers scope only from evidence and no claims for a cliché", () => {
    const scope = item("style.buzzword", "end-to-end");
    expect(guideFor(scope)!.buildChips(scope, "planning and testing", null)).toEqual(["planning", "testing"]);
    const cliché = item("style.buzzword", "team player");
    expect(guideFor(cliché)!.answerType).toBe("none");
    expect(guideFor(cliché)!.buildChips(cliché, "SQL and dbt", null)).toEqual([]);
  });

  it("replaces just the span and refuses stale, empty and unchanged answers", () => {
    const i = item("style.jobAd", "technical solutions", 6);
    const text = "Built technical solutions for finance.";
    const draft = guidedItem(i, text, "dashboards")!;
    expect(draft).toMatchObject({ start: 6, end: 25, before: "technical solutions", after: "dashboards" });
    expect(buildComparison(draft, text).suggested).toBe("Built dashboards for finance.");
    for (const answer of ["", "  ", "\u0000", "technical solutions"]) expect(guidedItem(i, text, answer)).toBeNull();
    expect(guidedItem(i, "Changed text", "dashboards")).toBeNull();
  });

  it("handles markup-split phrases without changing surrounding words or formatting", () => {
    const text = "Built **technical** solutions for *finance*.";
    const plain = stripBulletMarkup(text);
    const start = plainToMarkedOffset(text, plain.indexOf("technical"));
    const end = plainToMarkedOffset(text, plain.indexOf(" for"), "end");
    const i = item("style.jobAd", text.slice(start, end), start);
    const draft = guidedItem(i, text, "dashboards")!;
    const result = buildComparison(draft, text).suggested!;
    expect(stripBulletMarkup(result)).toBe("Built dashboards for finance.");
    expect(parseBulletMarkup(result).find((r) => r.text.includes("finance"))?.italic).toBe(true);
  });

  it("never invents a metric or unit and requires a number the person typed", () => {
    const i = item("integrity.no-metrics", "Built reports.");
    const guide = guideFor(i)!;
    expect(guide.buildChips(i, "Saved 25% in another role", null)).toEqual([]);
    expect(guidedItem(i, i.before, "")).toBeNull();
    expect(guidedItem(i, i.before, "many")).toBeNull();
    expect(guidedItem(i, i.before, "5 reports per week")?.after).toBe("Built reports. (5 reports per week)");
    expect(guidedItem(i, i.before, "5")?.after).toBe("Built reports. (5)");
  });

  it("keeps unknown rules and existing suggestions on the old comparison path", () => {
    const i = item("unknown", "word");
    expect(guideFor(i)).toBeNull();
    expect(guidedItem(i, "word", "new")).toBeNull();
    expect(buildComparison(i, "word")).toEqual({ original: "word", suggested: null, flagged: [0, 4] });
    expect(guideFor({ ...item("style.passive", "was improved"), after: "Improved" })).toBeNull();
  });

  it("prepares confirm guides without creating a content change", () => {
    const i = item("factcheck.metric", "25%");
    expect(guideFor(i)?.answerType).toBe("confirm");
    expect(guidedItem(i, "25%", "yes")).toBeNull();
  });

  it("prioritises verification, metrics, vague wording and then minor style", () => {
    expect(["style.passive", "style.jobAd", "integrity.no-metrics", "factcheck.metric"].map((r) => reviewPriority(item(r, "x")))).toEqual([3, 2, 1, 0]);
    expect(reviewPriority(item("integrity.summary-case", "x"))).toBe(3);
  });

  it.each(["__proto__", "constructor", "toString"])("treats inherited property %s as an unknown rule", (rule) => {
    expect(guideFor(item(rule, "word"))).toBeNull();
    expect(guidedItem(item(rule, "word"), "word", "new")).toBeNull();
  });

  it("does not turn receiving training or an assignment into performing it", () => {
    for (const phrase of ["Was trained", "Was assigned", "Was selected"]) {
      const i = item("style.passive", phrase);
      expect(guideFor(i)!.buildChips(i, "", null)).toEqual([]);
    }
  });

  it("does not allow marker-only answers to erase the flagged content", () => {
    const i = item("style.jobAd", "technical solutions");
    for (const answer of ["*", "**", "***", " ** ** "]) expect(guidedItem(i, i.before, answer)).toBeNull();
  });

  it("rejects invalid offsets for both text and number guides", () => {
    for (const rule of ["style.jobAd", "integrity.no-metrics"]) {
      const i = item(rule, "word");
      for (const over of [{ start: -1 }, { start: 0.5 }, { end: 99 }, { end: Infinity }, { end: NaN }]) {
        expect(guidedItem({ ...i, ...over }, "word", "5 reports")).toBeNull();
      }
    }
  });

  it("preserves surrounding text and formatting across 256 combinations of split markup", () => {
    const characters = (text: string) => parseBulletMarkup(text).flatMap((r) => [...r.text].map((char) => ({ char, bold: r.bold, italic: r.italic })));
    for (let mask = 0; mask < 256; mask++) {
      const text = serializeBulletRuns(["Built ", "technical", " solutions", " for finance."].map((part, n) => ({
        text: part, bold: Boolean(mask & (1 << (n * 2))), italic: Boolean(mask & (2 << (n * 2))),
      })));
      const raw = wordingItems({ id: "experienceBullet:0:0", text, label: "Experience", writable: true }, { protectedTerms: [] })[0];
      const i = { ...item("style.jobAd", ""), ...raw };
      const draft = guidedItem(i, text, "dashboards")!;
      const result = buildComparison(draft, text).suggested!;
      expect(stripBulletMarkup(result), `format mask ${mask}`).toBe("Built dashboards for finance.");
      expect(characters(result).slice(0, 6)).toEqual(characters(text).slice(0, 6));
      expect(characters(result).slice(-13)).toEqual(characters(text).slice(-13));
    }
  });

  it("does not let custom formatting leak into the rest of the bullet", () => {
    const text = "Built technical solutions for finance.";
    const i = item("style.jobAd", "technical solutions", 6);
    const draft = guidedItem(i, text, "**dashboards")!;
    const result = buildComparison(draft, text).suggested!;
    expect(stripBulletMarkup(result)).toBe("Built dashboards for finance.");
    expect(parseBulletMarkup(result).find((run) => run.text.includes("finance"))?.bold).toBe(false);
  });
});
