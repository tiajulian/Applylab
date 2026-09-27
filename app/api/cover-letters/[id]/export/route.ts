import { acquireHeavySlots, enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { generateCoverLetterPDF } from "@/lib/pdf/generatePDF";
import { generateCoverLetterDocx } from "@/lib/export/coverLetterDocx";
import { COVER_LETTER_ERROR_CODES } from "@/lib/coverLetter/config";
import { parseContent } from "@/lib/coverLetter/content";
import { canUseFeature } from "@/lib/coverLetter/entitlements";
import { exportFilename, isExportFormat } from "@/lib/coverLetter/export";

// Uses cookies() (via requireUser/createClient) on every request, so it is never statically rendered.
export const dynamic = "force-dynamic";

// Launching headless Chromium (cold start included) can outlast the platform default timeout.
export const maxDuration = 60;

const CONTENT_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

/** Downloads a saved standalone cover letter as PDF or Word. Pro only (`coverLetter.export`). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  let releaseSlot: (() => Promise<void>) | null = null;
  try {
    const { authUserId, appUser } = await requireUser();

    if (!canUseFeature(appUser.plan, "coverLetter.export")) {
      return NextResponse.json(
        { error: "Upgrade to Pro to download cover letters", code: COVER_LETTER_ERROR_CODES.locked },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const format: unknown = body?.format;
    if (!isExportFormat(format)) {
      return NextResponse.json({ error: "format must be pdf or docx" }, { status: 400 });
    }

    const rateLimited = await enforceRateLimit(`cover-letter-export:${appUser.id}`, 20, 10 * 60_000);
    if (rateLimited) return rateLimited;

    // Ownership is enforced twice: by RLS on this client, and by the explicit user_id match.
    const { data: letter } = await createClient()
      .from("cover_letters")
      .select("title, company, content")
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!letter) return NextResponse.json({ error: "Cover letter not found" }, { status: 404 });

    const { body: letterBody, contact } = parseContent(letter.content);
    if (!letterBody.trim()) {
      return NextResponse.json({ error: "This cover letter is empty, so there is nothing to download." }, { status: 400 });
    }

    let file: Buffer;
    if (format === "pdf") {
      const heavy = await acquireHeavySlots(createServiceRoleClient(), "pdf", appUser.id);
      if ("response" in heavy) return heavy.response;
      releaseSlot = heavy.release;
      file = await generateCoverLetterPDF(letterBody, contact, letter.company);
    } else {
      file = await generateCoverLetterDocx(letterBody, contact, letter.company);
    }

    // `status` is not client-writable (column grants), and this deliberately leaves `updated_at` alone:
    // the editor's autosave uses it as its version stamp, so touching it would fake a conflict.
    await createServiceRoleClient()
      .from("cover_letters")
      .update({ status: "downloaded" })
      .eq("id", params.id)
      .eq("user_id", authUserId);

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": CONTENT_TYPES[format],
        "Content-Disposition": `attachment; filename="${exportFilename(letter.title, format)}"`,
      },
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("cover letter export error", error);
    return NextResponse.json({ error: "Failed to generate the download" }, { status: 500 });
  } finally {
    await releaseSlot?.();
  }
}
