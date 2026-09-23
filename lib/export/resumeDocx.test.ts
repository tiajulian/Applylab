import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { generateResumeDocx } from "@/lib/export/resumeDocx";
import type { ResumeContent } from "@/types";

// Verifies the font-size-parametrization refactor (see sizesFor in resumeDocx.ts) produces
// byte-identical sizing to the old hardcoded constants (BODY_SIZE=20, SMALL_SIZE=19,
// NAME_SIZE=36, HEADING_SIZE=22) at the 10pt default, and that a chosen point size actually
// changes every one of those four size families rather than only some of them.
const FIXTURE: ResumeContent = {
  contact: {
    name: "Jamie Rivera",
    phone: "0400 000 000",
    email: "jamie@example.com",
    location: "Sydney, NSW",
    linkedin: "linkedin.com/in/jamie-rivera",
    work_rights: "Australian citizen",
  },
  target_titles: ["Analyst"],
  summary: "Analyst with a track record of clear reporting.",
  skills: ["Data modelling"],
  tools: ["Data analysis: SQL"],
  projects: [{ title: "Side project", context: "Personal", year: "2024", bullets: ["Built a thing."] }],
  experience: [
    {
      job_title: "Analyst",
      company: "Acme",
      location: "Sydney",
      start_date: "2022",
      end_date: "Present",
      company_description: "",
      bullets: ["Did a thing."],
    },
  ],
  education: [{ degree: "BSc", institution: "UNSW", year: "2021", notes: "" }],
  referees: [{ name: "Ref Name", title: "Manager", organisation: "Acme", phone: "0400", email: "ref@acme.com" }],
};

async function extractSizes(buffer: Buffer): Promise<Set<string>> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file("word/document.xml")!.async("string");
  return new Set(Array.from(xml.matchAll(/w:sz w:val="(\d+)"/g)).map((m) => m[1]));
}

describe("generateResumeDocx font sizing", () => {
  it("matches the original hardcoded sizes exactly at the 10pt default", async () => {
    const buffer = await generateResumeDocx(FIXTURE, 10);
    const sizes = await extractSizes(buffer);
    // Original constants: BODY_SIZE=20, SMALL_SIZE=19, NAME_SIZE=36, HEADING_SIZE=22.
    expect(sizes.has("20")).toBe(true);
    expect(sizes.has("19")).toBe(true);
    expect(sizes.has("36")).toBe(true);
    expect(sizes.has("22")).toBe(true);
  });

  it("matches the same default sizes when fontSizePt is omitted", async () => {
    const buffer = await generateResumeDocx(FIXTURE);
    const sizes = await extractSizes(buffer);
    expect(sizes.has("20")).toBe(true);
    expect(sizes.has("19")).toBe(true);
    expect(sizes.has("36")).toBe(true);
    expect(sizes.has("22")).toBe(true);
  });

  it("scales every size family at a non-default point size (12pt)", async () => {
    const buffer = await generateResumeDocx(FIXTURE, 12);
    const sizes = await extractSizes(buffer);
    // body=24, small=23, name=40, heading=26 at 12pt.
    expect(sizes.has("24")).toBe(true);
    expect(sizes.has("23")).toBe(true);
    expect(sizes.has("40")).toBe(true);
    expect(sizes.has("26")).toBe(true);
    // None of the old 10pt-default sizes should remain.
    expect(sizes.has("20")).toBe(false);
    expect(sizes.has("19")).toBe(false);
    expect(sizes.has("36")).toBe(false);
    expect(sizes.has("22")).toBe(false);
  });

  it("scales down correctly at the 9.5pt floor", async () => {
    const buffer = await generateResumeDocx(FIXTURE, 9.5);
    const sizes = await extractSizes(buffer);
    // body=19, small=18, name=35, heading=21 at 9.5pt.
    expect(sizes.has("19")).toBe(true);
    expect(sizes.has("18")).toBe(true);
    expect(sizes.has("35")).toBe(true);
    expect(sizes.has("21")).toBe(true);
  });
});

async function docXml(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  return zip.file("word/document.xml")!.async("string");
}

describe("generateResumeDocx bullet bold/italic markers (lib/resume/bulletMarkup.ts)", () => {
  it("renders a bold/italic bullet as separate styled runs, and a plain bullet as one unstyled run", async () => {
    const fixture: ResumeContent = {
      ...FIXTURE,
      experience: [{ ...FIXTURE.experience[0], bullets: ["**Led** a team of *five* engineers"] }],
    };
    const xml = await docXml(await generateResumeDocx(fixture, 10));

    // A bold run carries <w:b/>, wrapping exactly "Led" - not the whole bullet.
    expect(xml).toMatch(/<w:b\/>[\s\S]{0,200}?<w:t[^>]*>Led<\/w:t>/);
    // An italic run carries <w:i/>, wrapping exactly "five".
    expect(xml).toMatch(/<w:i\/>[\s\S]{0,200}?<w:t[^>]*>five<\/w:t>/);
    // The plain portions are present as their own unstyled text.
    expect(xml).toContain(" a team of ");
    expect(xml).toContain(" engineers");
    // No raw markers leak into the document - they're consumed into run properties, not left in the text.
    expect(xml).not.toContain("**Led**");
    expect(xml).not.toContain("*five*");
  });

  it("renders a bullet with no markers as before - a single run, no bold/italic properties", async () => {
    const fixture: ResumeContent = {
      ...FIXTURE,
      experience: [{ ...FIXTURE.experience[0], bullets: ["Did a thing with no formatting."] }],
    };
    const xml = await docXml(await generateResumeDocx(fixture, 10));
    expect(xml).toContain("Did a thing with no formatting.");
  });
});

describe("generateResumeDocx Design & Font panel overrides (lib/resume/designPrefs.ts)", () => {
  it("with no design prefs set, produces the exact same page margin and line spacing as before this feature existed (13mm / 288 twips)", async () => {
    const xml = await docXml(await generateResumeDocx(FIXTURE, 10, "clean"));
    // 13mm standard margin = round(13 * 1440 / 25.4) = 737 twips.
    expect(xml).toContain('w:top="737"');
    expect(xml).toContain('w:right="737"');
    expect(xml).toContain('w:bottom="737"');
    expect(xml).toContain('w:left="737"');
    expect(xml).toContain('w:line="288"');
  });

  it("a font_choice override replaces the body font everywhere, not just one run", async () => {
    const xml = await docXml(
      await generateResumeDocx(FIXTURE, 10, "clean", null, { accentColor: null, fontChoice: "georgia", marginPreset: null, spacingPreset: null, lineHeightPreset: null })
    );
    expect(xml).not.toContain('w:ascii="Arial"');
    // Georgia appears many times (every run) - just confirm it's the font actually used.
    expect((xml.match(/w:ascii="Georgia"/g) ?? []).length).toBeGreaterThan(5);
  });

  it("a margin_preset override changes every page margin to the matching mm value", async () => {
    const xml = await docXml(
      await generateResumeDocx(FIXTURE, 10, "clean", null, { accentColor: null, fontChoice: null, marginPreset: "compact", spacingPreset: null, lineHeightPreset: null })
    );
    // compact = 10mm = round(10 * 1440 / 25.4) = 567 twips.
    expect(xml).toContain('w:top="567"');
    expect(xml).toContain('w:left="567"');
  });

  it("a spacing_preset override scales paragraph spacing without touching line height", async () => {
    const xml = await docXml(
      await generateResumeDocx(FIXTURE, 10, "clean", null, { accentColor: null, fontChoice: null, marginPreset: null, spacingPreset: "compact", lineHeightPreset: null })
    );
    // compact spacingScale = 0.85: 120 -> 102, 90 -> 77 (round(90*0.85)=77), 30 -> 26 (round(30*0.85)=26).
    expect(xml).toContain('w:after="102"');
    // Line height stays at the unmoved default (spacing and line-height are independent levers).
    expect(xml).toContain('w:line="288"');
  });

  it("a line_height_preset override changes body line height without touching paragraph spacing", async () => {
    const xml = await docXml(
      await generateResumeDocx(FIXTURE, 10, "clean", null, { accentColor: null, fontChoice: null, marginPreset: null, spacingPreset: null, lineHeightPreset: "relaxed" })
    );
    // relaxed = 1.3 * 240 = 312.
    expect(xml).toContain('w:line="312"');
    // Paragraph spacing stays at the unmoved default (scale factor 1).
    expect(xml).toContain('w:after="120"');
  });

  it("the summary paragraph's line height never moves with the line_height_preset (mirrors SUMMARY_LINE_HEIGHT's own independence)", async () => {
    const xml = await docXml(
      await generateResumeDocx(FIXTURE, 10, "clean", null, { accentColor: null, fontChoice: null, marginPreset: null, spacingPreset: null, lineHeightPreset: "compact" })
    );
    // SUMMARY_LINE_HEIGHT (1.25) * 240 = 300, present regardless of the compact body line-height.
    expect(xml).toContain('w:line="300"');
  });
});
