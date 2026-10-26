import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";
import { getClientIp, ipRateKey } from "@/lib/security/clientIp";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { UnauthorizedError, requirePermanentUser, unauthorizedResponse } from "@/lib/requireUser";
import { parseProfileFromText, ProfileParseError } from "@/lib/anthropic/parseProfile";
import { extractTextFromFile, MAX_TEXT_LENGTH } from "@/lib/resume/extractText";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export const runtime = "nodejs";
// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

const RATE_LIMIT_MAX = 6;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requirePermanentUser();

    const clientIp = getClientIp(request.headers) ?? authUserId;
    const contentType = request.headers.get("content-type") ?? "";
    let file: File | null = null;
    let rawText = "";
    let turnstileToken: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const upload = formData.get("file");
      turnstileToken = (formData.get("turnstileToken") as string | null) ?? null;
      if (!(upload instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      file = upload;
    } else {
      const body = await request.json();
      turnstileToken = body.turnstileToken ?? null;
      if (!body.rawText || typeof body.rawText !== "string") {
        return NextResponse.json({ error: "rawText is required" }, { status: 400 });
      }
      rawText = body.rawText;
    }

    // The captcha runs before the upload is parsed (the expensive, risky step).
    const isVerified = await verifyTurnstileToken(turnstileToken, clientIp);
    if (!isVerified) {
      return NextResponse.json(
        { error: "Verification failed. Please try again." },
        { status: 403 }
      );
    }

    // After the captcha, before the rate limits: an unreadable file shouldn't use up a parse.
    const sourceText = file ? (await extractTextFromFile(file)).text : rawText;

    const serviceClient = createServiceRoleClient();

    const userAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `parse:${authUserId}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );
    const ipAllowed = await checkAndRecordRateLimit(
      serviceClient,
      `parse_ip:${ipRateKey(clientIp)}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_MS
    );

    if (!userAllowed || !ipAllowed) {
      return NextResponse.json(
        { error: "Too many document parses. Please wait a few minutes or paste your details manually." },
        { status: 429 }
      );
    }

    const profile = await parseProfileFromText(sourceText.slice(0, MAX_TEXT_LENGTH), authUserId, {
      supabase: createClient(),
      tier: appUser.plan,
    });
    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    if (error instanceof ProfileParseError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("parse-resume error", error);
    return NextResponse.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
