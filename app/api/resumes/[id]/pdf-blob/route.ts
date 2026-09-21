import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { acquireHeavySlots, rateLimit } from "@/lib/rateLimit";
import { assertResumeExportEntitlement, PaidFeatureError, requireUser, UnauthorizedError } from "@/lib/requireUser";
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
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser(request);

    // Same buckets as generate-pdf (both launch Chromium), so the two can't be combined to
    // double a user's export budget.
    const serviceClient = createServiceRoleClient();
    const limit = await rateLimit(serviceClient, `pdf:${appUser.id}`, 10, 10 * 60_000);
    if (!limit.allowed) {
      return withExtensionCors(
        NextResponse.json(
          { error: "Too many exports. Please try again shortly." },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        ),
        request
      );
    }
    const heavy = await acquireHeavySlots(createServiceRoleClient(), "pdf", appUser.id);
    if ("response" in heavy) return withExtensionCors(heavy.response, request);
    releaseSlot = heavy.release;

    const resumeId = params.id;

    if (!resumeId) {
      return withExtensionCors(NextResponse.json({ error: "Resume ID is required" }, { status: 400 }), request);
    }

    const supabase = createClient();
    await assertResumeExportEntitlement(supabase, appUser, resumeId);

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
    if (error instanceof PaidFeatureError) {
      return withExtensionCors(NextResponse.json({ error: error.message || "Upgrade to Pro to download PDFs" }, { status: 403 }), request);
    }
    console.error("pdf-blob error", error);
    return withExtensionCors(NextResponse.json({ error: "Failed to generate PDF blob" }, { status: 500 }), request);
  } finally {
    await releaseSlot?.();
  }
}

