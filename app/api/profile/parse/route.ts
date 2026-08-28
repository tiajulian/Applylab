import "@/lib/pdf/domPolyfills";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { parseProfileFromText, ProfileParseError } from "@/lib/anthropic/parseProfile";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
// Bounds the text handed to Claude regardless of source — a text-dense PDF/DOCX or a large
// pasted LinkedIn dump could otherwise blow the model's context window or run up cost
// unbounded. Generously larger than any real resume/profile.
const MAX_TEXT_LENGTH = 50_000;
const RATE_LIMIT_MAX = 6;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

async function extractTextFromFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new ProfileParseError("File is too large. Please upload a PDF or Word doc under 5 MB.");
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

  throw new ProfileParseError("Unsupported file type. Please upload a PDF or Word document (.docx).");
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || authUserId;
    const contentType = request.headers.get("content-type") ?? "";
    let sourceText: string;
    let turnstileToken: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      turnstileToken = (formData.get("turnstileToken") as string | null) ?? null;
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      sourceText = await extractTextFromFile(file);
    } else {
      const body = await request.json();
      turnstileToken = body.turnstileToken ?? null;
      if (!body.rawText || typeof body.rawText !== "string") {
        return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      }
      sourceText = body.rawText;
    }

    const isVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();

    const userAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `parse:${authUserId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );
    const ipAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `parse_ip:${clientIp}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );

    if (!userAllowed || !ipAllowed) {
      return NextResponse.json(
        { error: "Too many document parses. Please wait a few minutes or paste your details manually." },
        { status: 429 }
      );
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
