import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { generateCoverLetterDocx } from "./coverLetterDocx";
import type { ResumeContact } from "@/types";

const contact: ResumeContact = { name: "Tia Julian", phone: "", email: "tia@example.com", location: "Sydney, NSW", linkedin: "", work_rights: "" };
const letter = "Dear Hiring Manager,\n\nHello there.\n\nKind regards,\nTia Julian";

/** The text of each paragraph in a .docx, in order. */
async function paragraphs(buffer: Buffer): Promise<string[]> {
  const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
  return [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) => [...p[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(""));
}

describe("generateCoverLetterDocx", () => {
  it("has the address block between the date and the greeting", async () => {
    const lines = await paragraphs(await generateCoverLetterDocx(letter, contact, "Woolworths Group"));
    const greeting = lines.indexOf("Dear Hiring Manager,");
    expect(lines[0]).toBe("Tia Julian");
    expect(lines.slice(greeting - 2, greeting)).toEqual(["Hiring Manager", "Woolworths Group"]);
    // The date sits just above the block.
    expect(lines[greeting - 3]).toMatch(/\d{4}$/);
  });

  it("omits the block when the letter is addressed to a named person and the company is unknown", async () => {
    const lines = await paragraphs(await generateCoverLetterDocx("Dear Sarah,\n\nHello.", contact, null));
    expect(lines).not.toContain("Hiring Manager");
    expect(lines[lines.indexOf("Dear Sarah,") - 1]).toMatch(/\d{4}$/);
  });
});
