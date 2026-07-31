import "@/lib/pdf/domPolyfills";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { parseProfileFromText, ProfileParseError } from "@/lib/anthropic/parseProfile";

export const runtime = "nodejs";
// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
export const maxDuration = 60;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Bounds the text handed to Claude regardless of source — a text-dense PDF/DOCX or a large
// pasted LinkedIn dump could otherwise blow the model's context window or run up cost
// unbounded. Generously larger than any real resume/profile.
const MAX_TEXT_LENGTH = 50_000;

async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ProfileParseError("File is too large — please upload a PDF or Word doc under 5 MB");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return result.text;
    } finally {
      await parser.destroy();
    }
  }

  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new ProfileParseError("Unsupported file type — please upload a PDF or DOCX resume");
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    const contentType = request.headers.get("content-type") ?? "";
    let sourceText: string;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      sourceText = await extractTextFromFile(file);
    } else {
      const body = await request.json();
      if (!body.rawText || typeof body.rawText !== "string") {
        return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      }
      sourceText = body.rawText;
    }

    const profile = await parseProfileFromText(sourceText.slice(0, MAX_TEXT_LENGTH), authUserId);
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ProfileParseError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("parse-resume error", error);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
