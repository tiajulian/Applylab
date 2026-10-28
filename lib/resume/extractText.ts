import "@/lib/pdf/domPolyfills";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ProfileParseError } from "@/lib/anthropic/parseProfile";

import { MAX_FILE_BYTES } from "@/lib/resume/uploadLimits";

export { MAX_FILE_BYTES };
// Bounds the text handed to Claude regardless of source — a text-dense PDF/DOCX or a large
// pasted LinkedIn dump could otherwise blow the model's context window or run up cost
// unbounded. Generously larger than any real resume/profile.
export const MAX_TEXT_LENGTH = 50_000;
// A resume is a few pages; anything past this is not a resume and only costs parse time.
export const MAX_PDF_PAGES = 10;
// A real .docx resume unzips to well under 5 MB. A zip bomb declares far more.
export const MAX_DOCX_UNCOMPRESSED_BYTES = 30 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 20_000;

export type ResumeFileKind = "pdf" | "docx";

const UNREADABLE_FILE_MESSAGE = "We couldn't read that file. Please upload a PDF or Word document (.docx).";

/** The file's real type from its first bytes. The name and MIME type are the client's claim. A
 *  ZIP that isn't a Word document (xlsx, pptx, odt) is still "docx" here; mammoth refuses it. */
export function sniffResumeFileKind(buffer: Buffer): ResumeFileKind | null {
  if (buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) return "docx";
  // The PDF spec lets "%PDF-" sit anywhere in the first 1 KB.
  if (buffer.subarray(0, 1024).includes("%PDF-")) return "pdf";
  return null;
}

/**
 * Sum of the uncompressed sizes the ZIP's central directory declares, or null if it can't be read
 * (truncated, ZIP64, malformed). Read before mammoth inflates anything, so a zip bomb is refused
 * without decompressing it. A forged directory can under-declare; the function's memory limit and
 * maxDuration are the backstop for that.
 */
export function declaredZipUncompressedBytes(buffer: Buffer): number | null {
  const EOCD_SIGNATURE = 0x06054b50;
  const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
  const searchFrom = Math.max(0, buffer.length - 22 - 0xffff);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= searchFrom; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;

  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  if (entries === 0xffff || offset === 0xffffffff) return null; // ZIP64: not something Word writes for a resume

  let total = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== CENTRAL_HEADER_SIGNATURE) return null;
    const uncompressed = buffer.readUInt32LE(offset + 24);
    if (uncompressed === 0xffffffff) return null;
    total += uncompressed;
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
  return total;
}

/**
 * Rejects once `ms` passes, so a parse stuck waiting doesn't hold the request. It can't interrupt
 * synchronous work (the timer only fires when the parser yields): the page and size caps are what
 * bound that.
 */
function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  work.catch(() => {}); // a parse that loses the race may still reject later; nobody is waiting on it
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProfileParseError(UNREADABLE_FILE_MESSAGE)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Plain text from an uploaded PDF or Word (.docx) resume. Throws ProfileParseError with a
 *  message fit to show the user. */
export async function extractTextFromFile(file: File): Promise<{ text: string; kind: ResumeFileKind }> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ProfileParseError("File is too large. Please upload a PDF or Word doc under 5 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const kind = sniffResumeFileKind(buffer);

  if (kind === "pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await withTimeout(parser.getText({ first: MAX_PDF_PAGES }), PARSE_TIMEOUT_MS);
      return { text: result.text, kind };
    } catch (error) {
      // A malformed or encrypted PDF: tell the user, rather than fail with a 500.
      if (error instanceof ProfileParseError) throw error;
      throw new ProfileParseError(UNREADABLE_FILE_MESSAGE);
    } finally {
      // After a timeout the parse may still be running; a failed teardown mustn't replace the error.
      await parser.destroy().catch(() => {});
    }
  }

  if (kind === "docx") {
    const declared = declaredZipUncompressedBytes(buffer);
    if (declared === null || declared > MAX_DOCX_UNCOMPRESSED_BYTES) {
      throw new ProfileParseError(UNREADABLE_FILE_MESSAGE);
    }
    try {
      const result = await withTimeout(mammoth.extractRawText({ buffer }), PARSE_TIMEOUT_MS);
      return { text: result.value, kind };
    } catch (error) {
      // e.g. a ZIP that isn't a Word document: tell the user, rather than fail with a 500.
      if (error instanceof ProfileParseError) throw error;
      throw new ProfileParseError(UNREADABLE_FILE_MESSAGE);
    }
  }

  throw new ProfileParseError("Unsupported file type. Please upload a PDF or Word document (.docx).");
}
