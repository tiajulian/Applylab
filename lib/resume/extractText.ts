import "@/lib/pdf/domPolyfills";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ProfileParseError } from "@/lib/anthropic/parseProfile";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Bounds the text handed to Claude regardless of source — a text-dense PDF/DOCX or a large
// pasted LinkedIn dump could otherwise blow the model's context window or run up cost
// unbounded. Generously larger than any real resume/profile.
export const MAX_TEXT_LENGTH = 50_000;

export type ResumeFileKind = "pdf" | "docx";

/** Plain text from an uploaded PDF or Word (.docx) resume. Throws ProfileParseError with a
 *  message fit to show the user. */
export async function extractTextFromFile(file: File): Promise<{ text: string; kind: ResumeFileKind }> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ProfileParseError("File is too large. Please upload a PDF or Word doc under 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return { text: result.text, kind: "pdf" };
    } finally {
      await parser.destroy();
    }
  }

  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, kind: "docx" };
  }

  throw new ProfileParseError("Unsupported file type. Please upload a PDF or Word document (.docx).");
}
