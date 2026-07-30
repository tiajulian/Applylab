import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { assistBullet, AssistBulletError, type AssistAction } from "@/lib/anthropic/assistBullet";
import {
  AssistLimitReachedError,
  refundAssistCall,
  requireUser,
  reserveAssistCall,
  UnauthorizedError,
} from "@/lib/requireUser";
import type { Resume } from "@/types";

const VALID_ACTIONS: AssistAction[] = ["rewrite", "quantify", "shorten", "senior"];
const MAX_BULLET_LENGTH = 2000;

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  let reserved = false;

  try {
    const { appUser } = await requireUser();

    const body = await request.json();
    const bulletText = typeof body.bulletText === "string" ? body.bulletText : "";
    const action = body.action as AssistAction;
    const roleTitle = typeof body.roleTitle === "string" ? body.roleTitle : undefined;
    const roleCompany = typeof body.roleCompany === "string" ? body.roleCompany : undefined;

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

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;

    await reserveAssistCall(supabase, appUser, resumeRow.id);
    reserved = true;

    const options = await assistBullet({
      bulletText,
      action,
      roleTitle,
      roleCompany,
      jobTitle: resumeRow.job_title ?? "",
      companyName: resumeRow.company_name ?? "",
      jobDescription: resumeRow.job_description,
    });

    return NextResponse.json({ options });
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
        { error: "AI-assist limit reached for this resume — upgrade for unlimited assist" },
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
