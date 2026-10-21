import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePermanentUser, UnauthorizedError, unauthorizedResponse } from "@/lib/requireUser";
import { MAX_PICK_LINES, suggestLinePicks } from "@/lib/anthropic/suggestLinePicks";

// Uses cookies() (via requirePermanentUser) on every request, so it can never be statically rendered.
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 500;

/**
 * Likely tools and people/teams for each line, shown as optional picks before "Improve all the
 * wording" runs. Free on purpose: it never reserves a free-tier use (the rewrite that follows is
 * the one use), so it only has a per-user hourly rate limit. The client treats any failure here as
 * "no picks" and goes straight to the rewrite.
 */
export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requirePermanentUser();
    const rateLimited = await enforceRateLimit(`line-picks:${authUserId}`, 20, 60 * 60_000);
    if (rateLimited) return rateLimited;

    const body = await request.json().catch(() => ({}));
    const lines: string[] = (Array.isArray(body.lines) ? body.lines : [])
      .map((v: unknown) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT_LENGTH) : ""))
      .slice(0, MAX_PICK_LINES);
    if (lines.length === 0 || lines.some((line) => !line)) {
      return NextResponse.json({ error: "lines must be non-empty strings" }, { status: 400 });
    }
    const jobTitle = typeof body.jobTitle === "string" ? body.jobTitle.trim().slice(0, MAX_TEXT_LENGTH) : "";
    const company = typeof body.company === "string" ? body.company.trim().slice(0, MAX_TEXT_LENGTH) : "";

    const picks = await suggestLinePicks(lines, { jobTitle, company }, { userId: authUserId, supabase: createClient(), tier: appUser.plan });
    return NextResponse.json({ picks });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("line-picks error", error);
    return NextResponse.json({ error: "Failed to suggest tools and teams" }, { status: 500 });
  }
}
