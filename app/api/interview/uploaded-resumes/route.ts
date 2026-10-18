import { aiErrorResponse } from "@/lib/aiGateway/errorResponse";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rateLimit";
import { assertPaidPlan, PaidFeatureError, requireUser, UnauthorizedError, unauthorizedResponse } from "@/lib/requireUser";
import { parseProfileFromText, ProfileParseError } from "@/lib/anthropic/parseProfile";
import { extractTextFromFile, MAX_TEXT_LENGTH } from "@/lib/resume/extractText";
import { MAX_UPLOADED_RESUMES, MIN_RESUME_TEXT_LENGTH, uploadedResumeName } from "@/lib/interview/uploadedResume";
import type { UploadedResume } from "@/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Reading the resume is one Claude call (with its own retries); see profile/parse/route.ts.
export const maxDuration = 120;

const SUMMARY_COLUMNS = "id, name, source, created_at";

/** Saves a resume not made in ApplyLab for practice interviews: a PDF/Word file (multipart
 *  "file") or pasted text (JSON "text"). Read once here into the Career Profile shape. Pro only. */
export async function POST(request: Request) {
  try {
    const { authUserId, appUser } = await requireUser();
    assertPaidPlan(appUser);

    const rateLimited = await enforceRateLimit(
      `uploaded-resume:${authUserId}`,
      6,
      10 * 60_000,
      "You've added a lot of resumes in a short time. Please wait a few minutes."
    );
    if (rateLimited) return rateLimited;

    const supabase = createClient();
    const { count } = await supabase
      .from("uploaded_resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUserId);
    if ((count ?? 0) >= MAX_UPLOADED_RESUMES) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_UPLOADED_RESUMES} resumes. Delete one you no longer use, then try again.` },
        { status: 409 }
      );
    }

    let text: string;
    let source: UploadedResume["source"];
    let fileName: string | null = null;
    if ((request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
      const extracted = await extractTextFromFile(file);
      text = extracted.text;
      source = extracted.kind;
      fileName = file.name;
    } else {
      const body = await request.json().catch(() => ({}));
      text = typeof body.text === "string" ? body.text : "";
      source = "paste";
    }

    text = text.trim().slice(0, MAX_TEXT_LENGTH);
    if (text.length < MIN_RESUME_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error:
            source === "paste"
              ? "That looks too short to be a resume. Paste the whole thing."
              : "We couldn't read much text from that file. It may be a scanned image. Try pasting the text instead.",
        },
        { status: 422 }
      );
    }

    const parsed = await parseProfileFromText(text, authUserId, { supabase, tier: appUser.plan });

    const { data: saved, error } = await createServiceRoleClient()
      .from("uploaded_resumes")
      .insert({ user_id: authUserId, name: uploadedResumeName(fileName, parsed), source, raw_text: text, parsed })
      .select(SUMMARY_COLUMNS)
      .single();
    if (error || !saved) {
      console.error("Failed to save uploaded resume", error);
      return NextResponse.json({ error: "Failed to save your resume" }, { status: 500 });
    }

    return NextResponse.json({ resume: saved });
  } catch (error) {
    if (error instanceof UnauthorizedError) return unauthorizedResponse(error);
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to practise with your own resume" }, { status: 403 });
    }
    if (error instanceof ProfileParseError) return NextResponse.json({ error: error.message }, { status: 422 });
    const aiRefusal = aiErrorResponse(error);
    if (aiRefusal) return aiRefusal;
    console.error("upload resume error", error);
    return NextResponse.json({ error: "Failed to read your resume" }, { status: 500 });
  }
}
