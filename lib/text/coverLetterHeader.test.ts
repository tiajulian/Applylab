import { describe, expect, it } from "vitest";
import { buildCoverLetterHeader, buildCoverLetterRecipient } from "./coverLetterHeader";

const letter = (greeting: string) => `${greeting}\n\nI would love to join your team.\n\nKind regards,\nTia`;

describe("buildCoverLetterRecipient", () => {
  it("addresses the Hiring Manager at the company when the letter opens that way", () => {
    expect(buildCoverLetterRecipient(letter("Dear Hiring Manager,"), "Woolworths Group")).toEqual(["Hiring Manager", "Woolworths Group"]);
  });

  it("matches the greeting however it is written", () => {
    expect(buildCoverLetterRecipient(letter("dear hiring manager"), "Acme")).toEqual(["Hiring Manager", "Acme"]);
    expect(buildCoverLetterRecipient("\n\n  Dear Hiring Manager,\nHello", "Acme")).toEqual(["Hiring Manager", "Acme"]);
  });

  it("never contradicts a letter addressed to a named person: only the company is shown", () => {
    expect(buildCoverLetterRecipient(letter("Dear Sarah,"), "Acme")).toEqual(["Acme"]);
  });

  it("shows just Hiring Manager when the company is unknown", () => {
    expect(buildCoverLetterRecipient(letter("Dear Hiring Manager,"), null)).toEqual(["Hiring Manager"]);
    expect(buildCoverLetterRecipient(letter("Dear Hiring Manager,"), "   ")).toEqual(["Hiring Manager"]);
    expect(buildCoverLetterRecipient(letter("Dear Hiring Manager,"))).toEqual(["Hiring Manager"]);
  });

  it("is empty when there is nothing to address", () => {
    expect(buildCoverLetterRecipient(letter("Dear Sarah,"), null)).toEqual([]);
    expect(buildCoverLetterRecipient("", "")).toEqual([]);
  });

  it("does not treat 'Hiring Manager' appearing later in the text as the greeting", () => {
    expect(buildCoverLetterRecipient("Hello team,\nI am writing to the Hiring Manager.", "Acme")).toEqual(["Acme"]);
  });

  it("keeps the header unchanged", () => {
    const header = buildCoverLetterHeader({ name: "Tia", phone: "", email: "t@x.co", location: "Sydney", linkedin: "", work_rights: "" }, new Date("2026-08-02T00:00:00Z"));
    expect(header).toMatchObject({ name: "Tia", contactLine: "Sydney | t@x.co" });
  });
});
