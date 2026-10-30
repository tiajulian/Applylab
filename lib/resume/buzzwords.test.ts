import { describe, expect, it } from "vitest";
import { findBuzzword, groundedBuzzwordExample, shouldFlagBuzzword, suggestBulletChips } from "./contentChecks";
import { stripBulletMarkup } from "./bulletMarkup";
import { styleItems, wordingItems } from "@/lib/review/rules";
import { assignIds, reconcile } from "@/lib/review/engine";

export const earned = "Owned the end-to-end pipeline for a new vendor accreditation program using dbt, Snowflake, and Tableau, reducing vendor accreditation time from 6.8 days to 1.4 days.";
const block = (text: string) => ({ id: "experienceBullet:0:0", text, label: "Experience", writable: true });

describe("shared buzzword policy", () => {
  it("earns scope wording with real evidence across cards and chips", () => {
    expect(shouldFlagBuzzword(earned, "end-to-end")).toBe(false);
    expect(findBuzzword(earned)).toBeNull();
    expect(styleItems(block(earned))).toEqual([]);
    expect(wordingItems(block(earned), { protectedTerms: [] })).toEqual([]);
    expect(suggestBulletChips(earned).map((c) => c.label)).not.toContain("Cut the fluff");
  });

  it.each([
    "Delivered end-to-end solutions for stakeholders",
    "Results-driven team player with end-to-end ownership",
    "Team player who cut report time using dbt.",
  ])("flags unsupported scope or an always-flag cliché: %s", (text) => {
    expect(findBuzzword(text)).not.toBeNull();
    expect(styleItems(block(text))).toHaveLength(1);
    expect(suggestBulletChips(text).map((c) => c.label)).toContain("Cut the fluff");
  });

  it("counts distinct evidence types and excludes the opening capital from named systems", () => {
    expect(shouldFlagBuzzword("Delivered end-to-end solutions", "end-to-end")).toBe(true);
    expect(shouldFlagBuzzword("Delivered End-to-end solutions for report stakeholders", "end-to-end")).toBe(true);
    expect(shouldFlagBuzzword("Built an end-to-end pipeline", "end-to-end")).toBe(false);
    expect(shouldFlagBuzzword("An end-to-end migration using dbt", "end-to-end")).toBe(false);
    expect(shouldFlagBuzzword("Delivered data-driven solutions using Tableau", "data-driven")).toBe(false);
  });

  it("detects split markup and maps offsets back to the stored string", () => {
    const text = "Delivered **end**-to-*end* solutions for stakeholders";
    const [item] = styleItems(block(text));
    expect(stripBulletMarkup(text.slice(item.start, item.end))).toBe("end-to-end");
    expect(findBuzzword(stripBulletMarkup(text))).toBe("end-to-end");
    expect(suggestBulletChips(text).map((c) => c.label)).toContain("Cut the fluff");
  });

  it("matches whole phrases and highlights the actual occurrence rather than a word prefix", () => {
    expect(findBuzzword("Delivered end-to-endless solutions")).toBeNull();
    const text = "Delivered end-to-endless solutions and **end-to-end** support";
    const [item] = styleItems(block(text));
    expect(item.start).toBe(text.indexOf("**"));
    expect(stripBulletMarkup(item.before)).toBe("end-to-end");
  });

  it("counts named tools at the opening and immediately after an opening scope phrase", () => {
    expect(shouldFlagBuzzword("dbt powers an end-to-end pipeline", "end-to-end")).toBe(false);
    expect(shouldFlagBuzzword("End-to-end Quokka migration", "end-to-end")).toBe(false);
  });

  it("preserves protection for the user's own skill names, including split markup", () => {
    const text = "Wrote **end**-to-end testing suites";
    const ctx = { protectedTerms: ["End-to-end testing"] };
    expect(styleItems(block(text), ctx)).toEqual([]);
    expect(wordingItems(block(text), ctx)).toEqual([]);
    // Always-flag clichés are not made meaningful by being listed as a skill.
    expect(styleItems(block("Team player who cut report time using dbt."), { protectedTerms: ["Team player"] })).toHaveLength(1);
  });

  it("only offers a complete grounded example using existing words", () => {
    const original = "Team player who cut report time using dbt by 25%.";
    const example = groundedBuzzwordExample(original, "team player")!;
    expect(example).toBe("Cut report time using dbt by 25%.");
    const words = (s: string) => s.toLowerCase().match(/[\w.%]+/g)!;
    expect(words(example).every((word) => words(original).includes(word))).toBe(true);
    expect(groundedBuzzwordExample("Delivered end-to-end solutions for stakeholders", "end-to-end")).toBeNull();
    expect(groundedBuzzwordExample("Team player who enjoys teamwork", "team player")).toBeNull();
  });

  it("keeps the same unchanged flag dismissed across reanalysis", () => {
    const raw = styleItems(block("Delivered end-to-end solutions for stakeholders"));
    const args = { resumeId: "r1", raw, analysedBlocks: new Set([raw[0].blockId]), kept: new Set<string>() };
    const first = reconcile({ ...args, prev: [], dismissed: new Set() });
    const legacy = assignIds("r1", [{ ...raw[0], ruleId: "style.jobAd" }])[0];
    expect(first[0].id).toBe(legacy.id);
    expect(reconcile({ ...args, prev: first, dismissed: new Set([first[0].id]) })[0].status).toBe("dismissed");
  });
});
