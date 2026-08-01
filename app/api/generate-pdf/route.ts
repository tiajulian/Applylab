import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateCoverLetterPDF, generateResumePDF } from "@/lib/pdf/generatePDF";
import { assertPaidPlan, PaidFeatureError, requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import type { Resume } from "@/types";

// Launching headless Chromium (cold start included) can take longer than the platform
// default function timeout — this is the max Vercel allows without Fluid Compute on Hobby.
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { appUser } = await requireUser();
    assertPaidPlan(appUser);

    const { resumeId, type } = await request.json();

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

    let pdfBuffer: Buffer;
    let filename: string;

    if (type === "cover-letter") {
      if (!resumeRow.cover_letter_content) {
        return NextResponse.json({ error: "Cover letter not generated yet" }, { status: 400 });
      }
      pdfBuffer = await generateCoverLetterPDF(resumeRow.cover_letter_content);
      filename = "cover-letter.pdf";
    } else {
      if (!resumeRow.resume_content) {
        return NextResponse.json({ error: "Resume not generated yet" }, { status: 400 });
      }
      pdfBuffer = await generateResumePDF(sanitizeResumeContent(resumeRow.resume_content), resumeRow.template);
      filename = "resume.pdf";

      const storagePath = `${resumeRow.user_id}/${resumeRow.id}.pdf`;
      const { error: uploadError } = await supabase.storage
        .from("resumes")
        .upload(storagePath, pdfBuffer, { contentType: "application/pdf", upsert: true });

      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from("resumes").getPublicUrl(storagePath);
        // pdf_url is intentionally not client-writable (see supabase/schema.sql column-privilege
        // lockdown) — ownership was already verified by the RLS-scoped select above.
        await createServiceRoleClient()
          .from("resumes")
          .update({ pdf_url: publicUrl.publicUrl })
          .eq("id", resumeId);
      }
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to download PDFs" }, { status: 403 });
    }
    console.error("generate-pdf error", error);
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 });
  }
}
