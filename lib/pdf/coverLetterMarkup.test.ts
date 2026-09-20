import { describe, expect, it } from "vitest";
import { coverLetterMarkup } from "./generatePDF";
import type { ResumeContact } from "@/types";

const contact: ResumeContact = { name: "Tia Julian", phone: "", email: "tia@example.com", location: "Sydney, NSW", linkedin: "", work_rights: "" };
const letter = "Dear Hiring Manager,\n\nHello there.\n\nKind regards,\nTia Julian";
const date = new Date("2026-08-02T00:00:00Z");

describe("coverLetterMarkup", () => {
  it("puts the address block between the date and the greeting", () => {
    const html = coverLetterMarkup(letter, contact, "Woolworths Group", date);
    const at = (text: string) => html.indexOf(text);
    expect(at("Tia Julian")).toBeGreaterThan(-1);
    expect(at("2 August 2026")).toBeGreaterThan(at("Tia Julian"));
    expect(at("data-recipient")).toBeGreaterThan(at("2 August 2026"));
    expect(html).toContain("<div>Hiring Manager</div><div>Woolworths Group</div>");
    expect(at("Woolworths Group")).toBeLessThan(at("<p style=\"margin:0 0 14px;\">Dear Hiring Manager,"));
  });

  it("escapes the company name", () => {
    const html = coverLetterMarkup(letter, contact, "R&D <Labs>", date);
    expect(html).toContain("R&amp;D &lt;Labs&gt;");
    expect(html).not.toContain("<Labs>");
  });

  it("leaves out the block when there is nothing to address, so the layout is exactly as before", () => {
    const html = coverLetterMarkup("Dear Sarah,\n\nHello.", contact, null, date);
    expect(html).not.toContain("data-recipient");
  });

  it("does not add the greeting twice", () => {
    const html = coverLetterMarkup(letter, contact, "Acme", date);
    expect(html.match(/Dear Hiring Manager/g)).toHaveLength(1);
  });
});
