import { NextResponse } from "next/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { parseJobAd } from "@/lib/anthropic/parseJobAd";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
export const maxDuration = 30;

const MIN_AD_LENGTH = 20;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 10;

/**
 * Best-effort, per-warm-instance only — separate serverless invocations don't share memory, so
 * this isn't a hard global cap. It's a cheap guard against a single client hammering a
 * non-metered autofill helper, not a security boundary (the client already debounces to 600ms
 * and this hits the cheap model with a small max_tokens), so an in-memory limiter is
 * proportionate here — a persistent/distributed limiter would be overkill for this.
 */
const callLog = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = callLog.get(userId);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    callLog.set(userId, { count: 1, windowStart: now });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX_CALLS;
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    if (isRateLimited(authUserId)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const adText = typeof body.adText === "string" ? body.adText : "";

    if (adText.trim().length < MIN_AD_LENGTH) {
      return NextResponse.json({ title: "", company: "" });
    }

    const result = await parseJobAd(adText, authUserId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Deliberately generic — this is a non-blocking autofill helper. The frontend treats any
    // non-2xx response the same way (leave title/company blank, no error shown), so there's no
    // need for a structured error body here the way there is on the real generation endpoints.
    console.error("parse-job-ad error", error);
    return NextResponse.json({ error: "Failed to parse job ad" }, { status: 500 });
  }
}
