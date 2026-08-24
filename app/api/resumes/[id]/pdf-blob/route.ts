import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { generateResumePDF } from "@/lib/pdf/generatePDF";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import type { Resume } from "@/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { authUserId } = await requireUser();
    const resumeId = params.id;

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }

    const supabase = createClient();
    const { data: resume, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", resumeId)
      .eq("user_id", authUserId)
      .single();

    if (error || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;
    if (!resumeRow.resume_content) {
      return NextResponse.json({ error: "Resume content is empty" }, { status: 400 });
    }

    const pdfBuffer = await generateResumePDF(
      sanitizeResumeContent(resumeRow.resume_content),
      resumeRow.template,
      resumeRow.font_size_pt
    );

    const safeTitle = (resumeRow.job_title || "Resume").replace(/[^a-zA-Z0-9_-]/g, "_");
    const filename = `${safeTitle}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("pdf-blob error", error);
    return NextResponse.json({ error: "Failed to generate PDF blob" }, { status: 500 });
  }
}
