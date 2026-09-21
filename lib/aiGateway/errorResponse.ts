import { NextResponse } from "next/server";
import { AiUnavailableError, QuotaExceededError } from "@/lib/aiGateway/errors";

/**
 * Maps the two ways the AI gateway can refuse a call to an HTTP response, or null for any other
 * error. Call in a route's catch block, after its own refunds:
 * `const r = aiErrorResponse(error); if (r) return r;`.
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
    // Free is a lifetime allowance (resetsAt is null). Reuse the FREE_LIMIT_REACHED contract the
    // existing screens already turn into an upgrade prompt, so every AI feature shows the paywall
    // without each screen learning a new code. `reason` lets a screen tell it apart if it wants to.
    if (error.resetsAt === null) {
      return NextResponse.json(
        {
          error: "You've used your free AI allowance. Upgrade to Pro to keep going.",
          code: "FREE_LIMIT_REACHED",
          reason: "ai_credits",
        },
        { status: 403 }
      );
    }

    // A windowed (Pro) allowance resets; say when.
    const resets = error.resetsAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
    return NextResponse.json(
      {
        error: `You've used this month's AI allowance. It resets on ${resets}.`,
        code: "AI_QUOTA_EXCEEDED",
        tier: error.tier,
        resetsAt: error.resetsAt.toISOString(),
      },
      { status: 429 }
    );
  }

  return null;
}
