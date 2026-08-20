import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { assistBullet, AssistBulletError } from "@/lib/anthropic/assistBullet";
import { EMPTY_COMPACT_JOB_AD } from "@/lib/anthropic/parseJobAd";

// Uses cookies() (via requireUser) on every request, so it can never be statically rendered.
export const dynamic = "force-dynamic";

// Shares the same "assist" feature bucket as win-polish/resume-assist (assistBullet always logs
// under that feature regardless of action) - this pre-check just adds the same soft backstop
// those routes have, on top of the pool they already draw from together.
const RATE_LIMIT_PER_HOUR = 20;
const MAX_DUTY_TEXTS = 8;
const MAX_TEXT_LENGTH = 500;

function stringField(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();
    const body = await request.json();

    const dutyTexts = Array.isArray(body.dutyTexts)
      ? body.dutyTexts
          .filter((v: unknown): v is string => typeof v === "string")
          .map((v: string) => v.trim().slice(0, MAX_TEXT_LENGTH))
          .filter(Boolean)
          .slice(0, MAX_DUTY_TEXTS)
      : [];
    const jobTitle = stringField(body.jobTitle, MAX_TEXT_LENGTH);
    const company = stringField(body.company, MAX_TEXT_LENGTH) || undefined;

    if (dutyTexts.length === 0) {
      return NextResponse.json({ error: "dutyTexts is required" }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("api_cost_log")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId)
      .eq("feature", "assist")
      .gte("created_at", oneHourAgo);

    // Checked against the batch size, not just the running count - a single request can fire up
    // to MAX_DUTY_TEXTS calls at once, so a plain "count >= limit" precheck lets one batch push
    // well past the intended hourly cap before the next request ever sees it.
    if ((count ?? 0) + dutyTexts.length > RATE_LIMIT_PER_HOUR) {
      return NextResponse.json(
        { error: "Generation limit reached for now. Try again shortly, or write it yourself." },
        { status: 429 }
      );
    }

    // Job-agnostic, same as "polish" - this rephrases a confirmed task into resume-bullet
    // grammar, it never targets any particular application (see BULLETIFY_INSTRUCTION).
    //
    // allSettled, not all - each duty text is an independent Claude call, and a single malformed
    // response (JSON parse failure, empty array) throws AssistBulletError for that call alone.
    // Promise.all would let one bad response 502 the whole batch, discarding every already-
    // generated draft and forcing the candidate to regenerate (and re-bill) everything, including
    // the ones that already worked.
    const settled = await Promise.allSettled(
      dutyTexts.map((dutyText: string) =>
        assistBullet(
          {
            bulletText: dutyText,
            action: "bulletify",
            roleTitle: jobTitle,
            roleCompany: company,
            jobTitle: "",
            companyName: "",
            compactJobAd: EMPTY_COMPACT_JOB_AD,
          },
          authUserId
        ).then((options) => ({ dutyText, text: options[0] as string | undefined }))
      )
    );

    const achievements: { dutyText: string; text: string }[] = [];
    let failedCount = 0;
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value.text) {
        achievements.push({ dutyText: result.value.dutyText, text: result.value.text });
      } else {
        failedCount++;
      }
    }

    if (achievements.length === 0) {
      return NextResponse.json(
        { error: "Couldn't generate achievements. Try again, or write them yourself." },
        { status: 502 }
      );
    }

    return NextResponse.json({ achievements, failedCount });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof AssistBulletError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("generate-achievements error", error);
    return NextResponse.json({ error: "Failed to generate achievements" }, { status: 500 });
  }
}
