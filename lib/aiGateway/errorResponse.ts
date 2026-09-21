import { NextResponse } from "next/server";
import { AiUnavailableError, QuotaExceededError } from "@/lib/aiGateway/errors";

/**
 * Maps the two ways the AI gateway can refuse a call to an HTTP response, or null for any other
 * error. Call first in a route's catch block: `const r = aiErrorResponse(error); if (r) return r;`.
 * Without this, a refusal surfaces as a generic 500 and the client can't tell "you're out of
 * credits" from "we're broken".
 */
export function aiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof AiUnavailableError) {
    return NextResponse.json(
      { error: "AI features are temporarily unavailable. Please try again shortly.", code: "AI_UNAVAILABLE" },
      { status: 503, headers: { "Retry-After": String(error.retryAfterSeconds) } }
    );
  }
  if (error instanceof QuotaExceededError) {
    return NextResponse.json(
      {
        error: "You've used your AI allowance.",
        code: "AI_QUOTA_EXCEEDED",
        tier: error.tier,
        resetsAt: error.resetsAt?.toISOString() ?? null,
      },
      { status: 429 }
    );
  }
  return null;
}
