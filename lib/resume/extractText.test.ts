import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

// The real module builds the AI clients at import time; only the error class is needed here.
vi.mock("@/lib/anthropic/parseProfile", () => ({ ProfileParseError: class ProfileParseError extends Error {} }));

import { ProfileParseError } from "@/lib/anthropic/parseProfile";
import {
  declaredZipUncompressedBytes,
  extractTextFromFile,
  MAX_DOCX_UNCOMPRESSED_BYTES,
  sniffResumeFileKind,
} from "./extractText";

async function zipOf(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

describe("sniffResumeFileKind", () => {
  it("goes by the file's bytes, not its name", async () => {
    expect(sniffResumeFileKind(Buffer.from("%PDF-1.7\n..."))).toBe("pdf");
    expect(sniffResumeFileKind(Buffer.concat([Buffer.from("junk before header "), Buffer.from("%PDF-1.4")]))).toBe("pdf");
    expect(sniffResumeFileKind(await zipOf({ "word/document.xml": "<w:document/>" }))).toBe("docx");
    expect(sniffResumeFileKind(Buffer.from("<html><script>alert(1)</script></html>"))).toBeNull();
  });
});

describe("declaredZipUncompressedBytes", () => {
  it("sums the sizes the central directory declares", async () => {
    const buffer = await zipOf({ "a.xml": "x".repeat(1000), "b.xml": "y".repeat(234) });
    expect(declaredZipUncompressedBytes(buffer)).toBe(1234);
  });

  it("returns null for something that isn't a readable zip", () => {
    expect(declaredZipUncompressedBytes(Buffer.from("PK\x03\x04 truncated"))).toBeNull();
  });
});

describe("extractTextFromFile", () => {
  it("refuses a file whose content isn't PDF or DOCX, whatever it's called", async () => {
    const file = new File(["not really a pdf"], "resume.pdf", { type: "application/pdf" });
    await expect(extractTextFromFile(file)).rejects.toBeInstanceOf(ProfileParseError);
  });

  it("refuses a ZIP that isn't a Word document with a message, not a crash", async () => {
    const pptx = await zipOf({ "ppt/presentation.xml": "<p:presentation/>" });
    await expect(extractTextFromFile(new File([new Uint8Array(pptx)], "resume.docx"))).rejects.toBeInstanceOf(ProfileParseError);
  });

  it("refuses a zip bomb before inflating it", async () => {
    const bomb = await zipOf({ "word/document.xml": "0".repeat(MAX_DOCX_UNCOMPRESSED_BYTES + 1) });
    expect(bomb.length).toBeLessThan(1024 * 1024);
    const file = new File([new Uint8Array(bomb)], "resume.docx");
    await expect(extractTextFromFile(file)).rejects.toThrow("couldn't read that file");
  });
});
