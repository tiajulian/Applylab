import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { MIN_JOB_AD_LENGTH } from "@/lib/anthropic/parseJobAd";
import { checkAndRecordRateLimit } from "@/lib/rateLimit";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why a short duration risks a mid-flight kill in practice.
export const maxDuration = 60;

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_CALLS = 10;

export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();

    // DB-backed (was an in-memory Map, per-warm-instance only - a real gap on Vercel's serverless
    // model, where separate invocations don't share memory and a scaled-out deployment easily has
    // many warm instances at once). Stopgap only (spec §12 step 1) - a per-feature reserve/gateway
    // port is the real fix, tracked separately, same as the other stopgapped routes.
    const allowed = await checkAndRecordRateLimit(
      createServiceRoleClient(),
      `parse-job-ad:${authUserId}`,
      RATE_LIMIT_MAX_CALLS,
      RATE_LIMIT_WINDOW_MS
    );
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const adText = typeof body.adText === "string" ? body.adText : "";

    if (adText.trim().length < MIN_JOB_AD_LENGTH) {
      return NextResponse.json({ title: "", company: "" });
    }

    // The form only reads title/company back today, but this call parses (or cache-hits) the
    // FULL compact job ad and writes the whole object to the cache on a miss - never just the
    // two fields the UI happens to use - so a later consumer (assist, ats-score, cover-letter,
    // retailor) cache-hits on a complete row instead of a half-empty one.
    const result = await getOrParseCompactJobAd(adText, authUserId, createClient(), appUser.plan);
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
