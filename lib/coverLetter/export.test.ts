import { describe, expect, it } from "vitest";
import { exportFilename, isExportFormat } from "./export";

describe("exportFilename", () => {
  it("uses the title with the format's extension", () => {
    expect(exportFilename("Business Analyst - Suncorp | Cover Letter", "pdf")).toBe("Business Analyst - Suncorp Cover Letter.pdf");
    expect(exportFilename("Note", "docx")).toBe("Note.docx");
  });

  it("strips characters that are unsafe in a filename or header", () => {
    expect(exportFilename('a/b\\c:"d"\r\n<e>', "pdf")).toBe("abcde.pdf");
  });

  it("falls back to a default name when nothing usable is left", () => {
    expect(exportFilename("", "pdf")).toBe("cover-letter.pdf");
    expect(exportFilename("///", "docx")).toBe("cover-letter.docx");
  });

  it("caps very long titles", () => {
    expect(exportFilename("a".repeat(300), "pdf")).toBe(`${"a".repeat(80)}.pdf`);
  });
});

describe("isExportFormat", () => {
  it("accepts only pdf and docx", () => {
    expect(isExportFormat("pdf")).toBe(true);
    expect(isExportFormat("docx")).toBe(true);
    expect(isExportFormat("txt")).toBe(false);
    expect(isExportFormat(undefined)).toBe(false);
  });
});
