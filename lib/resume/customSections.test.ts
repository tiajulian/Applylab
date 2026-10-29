import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { sanitizeResumeContent } from "./sanitizeResumeContent";
import * as Updaters from "./resumeFieldUpdaters";
import { profileListsFromParse, uploadedResumeContent } from "./importedProfile";
import { listBlocks, setBlockText } from "@/lib/review/blocks";
import { generateResumeDocx } from "@/lib/export/resumeDocx";
import { resumeScoreHash } from "./resumeScoreHash";
import { hashForScoring } from "./scoreCache";
import type { ResumeContent } from "@/types";

function resume(extra: Partial<ResumeContent> = {}): ResumeContent {
  return sanitizeResumeContent({
    contact: { name: "Sam Lee" },
    summary: "Summary",
    experience: [{ job_title: "Hand", company: "Co", bullets: ["Did a thing"] }],
    ...extra,
  });
}

const certs = { title: "Certifications", items: ["First Aid (HLTAID011)", "RSA"] };

describe("sanitizeResumeContent: optional sections", () => {
  it("keeps custom sections and drops fully blank ones, leaving the key absent when there are none", () => {
    expect(resume({ custom_sections: [certs, { title: "", items: [] }] }).custom_sections).toEqual([certs]);
    expect(resume()).not.toHaveProperty("custom_sections");
  });

  it("keeps a section still being typed (blank title, one blank line)", () => {
    expect(resume({ custom_sections: [{ title: "", items: [""] }] }).custom_sections).toEqual([{ title: "", items: [""] }]);
  });

  it("keeps the saved section order, dropping unknown ids and adding back any missing ones", () => {
    const order = resume({ section_order: ["education", "bogus", "education", "summary"] as never }).section_order;
    expect(order).toEqual(["education", "summary", "experience", "skills", "tools", "projects"]);
    expect(resume()).not.toHaveProperty("section_order");
  });
});

describe("custom section updaters", () => {
  it("adds, edits, moves and removes sections and their lines", () => {
    let r = Updaters.addCustomSection(resume());
    expect(r.custom_sections).toEqual([{ title: "", items: [""] }]);
    r = Updaters.updateCustomSection(r, 0, { title: "Awards" });
    r = Updaters.setCustomItem(r, 0, 0, "Employee of the month");
    r = Updaters.addCustomItem(r, 0, 0);
    expect(r.custom_sections![0].items).toEqual(["", "Employee of the month"]);
    r = Updaters.removeCustomItem(r, 0, 0);
    r = Updaters.addCustomSection(r);
    r = Updaters.moveCustomSection(r, 1, -1);
    expect(r.custom_sections!.map((s) => s.title)).toEqual(["", "Awards"]);
    r = Updaters.removeCustomSection(r, 0);
    expect(r.custom_sections).toEqual([{ title: "Awards", items: ["Employee of the month"] }]);
  });

  it("returns the same resume when a move goes nowhere", () => {
    const r = resume({ custom_sections: [certs] });
    expect(Updaters.moveCustomSection(r, 0, -1)).toBe(r);
    expect(Updaters.reorderCustomItem(r, 0, 1, 1)).toBe(r);
    expect(Updaters.moveCustomSection(resume(), 0, 1)).toEqual(resume());
  });
});

describe("review blocks for custom sections", () => {
  it("lists the heading and each line, and writes fixes back to them", () => {
    const r = resume({ custom_sections: [certs] });
    const blocks = listBlocks(r).filter((b) => b.id.startsWith("custom"));
    expect(blocks.map((b) => [b.id, b.text])).toEqual([
      ["customTitle:0", "Certifications"],
      ["customItem:0:0", "First Aid (HLTAID011)"],
      ["customItem:0:1", "RSA"],
    ]);
    expect(setBlockText(r, "customItem:0:1", "RSA (NSW)").custom_sections![0].items[1]).toBe("RSA (NSW)");
    expect(setBlockText(r, "customTitle:0", "Licences").custom_sections![0].title).toBe("Licences");
  });
});

describe("uploads with sections that have no field of their own", () => {
  const parsed = { fullName: "Sam", other_sections: [certs, { title: "Interests", items: ["Hiking"] }], education: [{ degree: "BCom", institution: "Uni" }] };

  it("open as custom sections, word for word", () => {
    const content = uploadedResumeContent(parsed, { name: "", email: "", phone: "", location: "", linkedin: "", work_rights: "" });
    expect(content.custom_sections).toEqual([certs, { title: "Interests", items: ["Hiking"] }]);
  });

  it("file into the profile: certificates as education and languages as skills; the rest stays on the resume", () => {
    const lists = profileListsFromParse({
      skills: ["Excel"],
      education: [{ degree: "BCom", institution: "Uni" }],
      other_sections: [
        { title: "Licences & Certifications", items: ["RSA", "Forklift licence"] },
        { title: "Languages", items: ["Mandarin (fluent), French"] },
        { title: "Volunteering", items: ["Red Cross, 2021-2023", "Ran weekly food drives"] },
        { title: "Languages & Certifications", items: ["Cantonese", "First Aid"] },
        { title: "Awards", items: ["Employee of the Month"] },
        { title: "Relevant Coursework", items: ["Statistics"] },
      ],
    });
    expect(lists.education.map((e) => e.degree)).toEqual(["BCom", "RSA", "Forklift licence"]);
    expect(lists.skills).toEqual(["Excel", "Mandarin (fluent)", "French"]);
    expect(lists.projects).toEqual([]);
  });
});

describe("Word export", () => {
  it("adds each custom section's heading and lines after education", async () => {
    const buffer = await generateResumeDocx(resume({ education: [{ degree: "BCom", institution: "Uni", year: "2018", notes: "" }], custom_sections: [certs] }));
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file("word/document.xml")!.async("string");
    const text = xml.replace(/<[^>]+>/g, " ");
    expect(text).toMatch(/Certifications/i);
    expect(text).toContain("First Aid (HLTAID011)");
    expect(text.indexOf("BCom")).toBeLessThan(text.indexOf("First Aid"));
  });
});

describe("Word export follows the saved section order", () => {
  it("puts Education first when the user moved it there, and skips blank bullets", async () => {
    const r = resume({
      education: [{ degree: "BCom", institution: "Uni", year: "2018", notes: "" }],
      experience: [{ job_title: "Hand", company: "Co", company_description: "", location: "", start_date: "", end_date: "", bullets: ["Did a thing", "  "] }],
      section_order: ["education", "summary", "experience", "skills", "tools", "projects"],
    });
    const zip = await JSZip.loadAsync(await generateResumeDocx(r));
    const xml = await zip.file("word/document.xml")!.async("string");
    const text = xml.replace(/<[^>]+>/g, " ");
    expect(text.indexOf("BCom")).toBeLessThan(text.indexOf("Did a thing"));
    expect((xml.match(/<w:p[ >]/g) ?? []).length).toBe((await docParagraphs(r)) );
  });
});

async function docParagraphs(r: ResumeContent): Promise<number> {
  const clean = { ...r, experience: r.experience.map((e) => ({ ...e, bullets: e.bullets.filter((b) => b.trim()) })) };
  const zip = await JSZip.loadAsync(await generateResumeDocx(clean));
  return ((await zip.file("word/document.xml")!.async("string")).match(/<w:p[ >]/g) ?? []).length;
}

describe("resumeScoreHash", () => {
  it("ignores section order, so reordering never makes a score stale", () => {
    const r = resume({ custom_sections: [certs] });
    expect(resumeScoreHash({ ...r, section_order: ["education", "summary", "experience", "skills", "tools", "projects"] })).toBe(resumeScoreHash(r));
    expect(resumeScoreHash({ ...r, summary: "Changed" })).not.toBe(resumeScoreHash(r));
  });

  it("matches the old hash for content saved before section order was kept", () => {
    const r = resume();
    expect(resumeScoreHash(r)).toBe(hashForScoring(JSON.stringify(r)));
    expect(resumeScoreHash(r, "ad")).toBe(hashForScoring("ad", JSON.stringify(r)));
  });
});
