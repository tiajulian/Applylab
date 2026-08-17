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
    // autofill ever firing) costs one extra Haiku call but backfills the shared cache for later.
    const compactJobAd = await getOrParseCompactJobAd(resumeRow.job_description, appUser.id);

    const options = await assistBullet({
      bulletText,
      action,
      roleTitle,
      roleCompany,
      jobTitle: resumeRow.job_title ?? "",
      companyName: resumeRow.company_name ?? "",
      compactJobAd,
      ...(action === "trim_unsupported" ? { unsupportedDetail } : {}),
    }, appUser.id);

    // Extra guard specific to the honesty-fix path: even though the prompt is instructed to only
    // remove the named detail, re-verify deterministically before returning anything to the
    // client - an option that still contains the unsupported detail, or that introduces a new
    // number the original bullet didn't have, failed to do "removal only" and must not be offered
    // as a fix. An empty result here is fine, not an error - the client falls back to the
    // deterministic "Remove bullet" option when nothing survives this guard.
    const safeOptions =
      action === "trim_unsupported"
        ? options.filter((opt) => !opt.includes(unsupportedDetail) && !bulletIntroducesNewNumbers(bulletText, opt))
        : options;

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
