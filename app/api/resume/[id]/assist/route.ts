import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assistBullet, AssistBulletError, type AssistBulletAction } from "@/lib/anthropic/assistBullet";
import { bulletIntroducesNewNumbers } from "@/lib/resume/factCheck";
import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import {
  AssistLimitReachedError,
  refundAssistCall,
  requireUser,
  reserveAssistCall,
  UnauthorizedError,
} from "@/lib/requireUser";
import type { Resume } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const VALID_ACTIONS: AssistBulletAction[] = ["rewrite", "quantify", "shorten", "senior", "trim_unsupported"];
const MAX_BULLET_LENGTH = 2000;
const MAX_UNSUPPORTED_DETAIL_LENGTH = 500;

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  let reserved = false;

  try {
    const { appUser } = await requireUser();

    const body = await request.json();
    const bulletText = typeof body.bulletText === "string" ? body.bulletText : "";
    const action = body.action as AssistBulletAction;
    const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle : undefined;
    const roleCompany = typeof body.roleCompany === "string" ? body.roleCompany : undefined;
    const unsupportedDetail = typeof body.unsupportedDetail === "string" ? body.unsupportedDetail : "";

    if (!bulletText.trim()) {
      return NextResponse.json({ error: "bulletText is required" }, { status: 400 });
    }
    if (bulletText.length > MAX_BULLET_LENGTH) {
      return NextResponse.json(
        { error: `bulletText must be ${MAX_BULLET_LENGTH} characters or fewer` },
        { status: 400 }
      );
    }
    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    if (action === "trim_unsupported") {
      if (!unsupportedDetail.trim()) {
        return NextResponse.json({ error: "unsupportedDetail is required for trim_unsupported" }, { status: 400 });
      }
      if (unsupportedDetail.length > MAX_UNSUPPORTED_DETAIL_LENGTH) {
        return NextResponse.json(
          { error: `unsupportedDetail must be ${MAX_UNSUPPORTED_DETAIL_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
    }

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;

    // Reserve (a free DB check) before spending any Claude tokens, so a user already over their
    // assist limit is rejected before the compact-JD parse below runs, not after.
    await reserveAssistCall(supabase, appUser, resumeRow.id);
    reserved = true;

    // Cache-hit in the common case: the New Resume form's autofill already parsed and cached
    // this exact ad when the candidate pasted it. A miss here (e.g. a resume created without
    // autofill ever firing) costs one extra call, now visible in the credit ledger under its own
    // "parse-job-ad" feature (spec §7's cache-miss fan-out requirement).
    const compactJobAd = await getOrParseCompactJobAd(resumeRow.job_description, appUser.id, supabase, appUser.plan);

    const options = await assistBullet({
      bulletText,
      action,
      roleTitle,
      roleCompany,
      jobTitle: resumeRow.job_title ?? "",
      companyName: resumeRow.company_name ?? "",
      compactJobAd,
      ...(action === "trim_unsupported" ? { unsupportedDetail } : {}),
    }, appUser.id, supabase, appUser.plan);

    // Deterministic honesty guard, applied to every action's suggestions before they reach the
    // client: the prompt is instructed not to invent numbers, but that's not enforced anywhere
    // until this check re-verifies it - without it, a hallucinated metric from any of
    // rewrite/quantify/shorten/senior would have reached the user unfiltered. trim_unsupported
    // additionally re-verifies it didn't just leave the named unsupported detail back in. An
    // empty result here is fine, not an error - the client shows a "try another chip" fallback
    // (or, for trim_unsupported, falls back to the deterministic "Remove bullet" option).
    const safeOptions = options.filter((opt) => {
      if (bulletIntroducesNewNumbers(bulletText, opt)) return false;
      if (action === "trim_unsupported" && opt.includes(unsupportedDetail)) return false;
      return true;
    });

    return NextResponse.json({ options: safeOptions });
  } catch (error) {
    if (reserved) {
      await refundAssistCall(supabase, params.id).catch((refundError) =>
        console.error("failed to refund assist reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof AssistLimitReachedError) {
      return NextResponse.json(
        { error: "AI-assist limit reached for this resume. Upgrade for unlimited assist." },
        { status: 403 }
      );
    }
    if (error instanceof AssistBulletError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    console.error("resume-assist error", error);
    return NextResponse.json({ error: "Failed to generate suggestions" }, { status: 500 });
  }
}
