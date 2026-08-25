import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { generateResumePDF } from "@/lib/pdf/generatePDF";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { extensionCorsPreflight, withExtensionCors } from "@/lib/extensionCors";
import type { Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request);
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId } = await requireUser(request);
    const resumeId = params.id;

    if (!resumeId) {
      return withExtensionCors(NextResponse.json({ error: "Resume ID is required" }, { status: 400 }), request);
    }

    const supabase = createClient();
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", authUserId)
      .single();

    if (error || !resume) {
      return withExtensionCors(NextResponse.json({ error: "Resume not found" }, { status: 404 }), request);
    }

    const resumeRow = resume as Resume;
    if (!resumeRow.resume_content) {
      return withExtensionCors(NextResponse.json({ error: "Resume content is empty" }, { status: 400 }), request);
    }

    const pdfBuffer = await generateResumePDF(
      sanitizeResumeContent(resumeRow.resume_content),
      resumeRow.template,
      resumeRow.font_size_pt
    );

    const safeTitle = (resumeRow.job_title || "Resume").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeTitle}.pdf`;

    return withExtensionCors(
      new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Content-Length": pdfBuffer.length.toString(),
        },
      }),
      request
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return withExtensionCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
    }
    console.error("pdf-blob error", error);
    return withExtensionCors(NextResponse.json({ error: "Failed to generate PDF blob" }, { status: 500 }), request);
  }
}
