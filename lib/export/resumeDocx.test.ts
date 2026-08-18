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
      description: "",
      bullets: ["Did a thing."],
      wins: [],
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
