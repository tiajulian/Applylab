import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCoverLetterDocx } from "@/lib/export/coverLetterDocx";
import { generateResumeDocx } from "@/lib/export/resumeDocx";
import { assertPaidPlan, PaidFeatureError, requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import type { Resume } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { appUser } = await requireUser();
    assertPaidPlan(appUser);

    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const { resumeId, type } = body;

    if (!resumeId || typeof resumeId !== "string") {
      return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;

    let docxBuffer: Buffer;
    let filename: string;

    if (type === "cover-letter") {
      if (!resumeRow.cover_letter_content || !resumeRow.resume_content) {
        return NextResponse.json({ error: "Cover letter not generated yet" }, { status: 400 });
      }
      docxBuffer = await generateCoverLetterDocx(
        resumeRow.cover_letter_content,
        sanitizeResumeContent(resumeRow.resume_content).contact
      );
      filename = "cover-letter.docx";
    } else {
      if (!resumeRow.resume_content) {
        return NextResponse.json({ error: "Resume not generated yet" }, { status: 400 });
      }
      // Always the plain ATS-safe layout, regardless of the selected PDF template — DOCX
      // exists for ATS parseability, not visual styling (see feature plan).
      docxBuffer = await generateResumeDocx(sanitizeResumeContent(resumeRow.resume_content));
      filename = "resume.docx";
    }

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to download Word documents" }, { status: 403 });
    }
    console.error("generate-docx error", error);
    return NextResponse.json({ error: "Failed to generate Word document" }, { status: 500 });
  }
}
