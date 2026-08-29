import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { canonicalTemplate, isValidTemplate, TEMPLATE_METADATA } from "@/lib/resume/templateMetadata";

import { isValidFontSizePt } from "@/lib/resume/templateDensity";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_COVER_LETTER_LENGTH = 20_000;
const MAX_JOB_TITLE_LENGTH = 200;

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { appUser } = await requireUser();

    const body = await request.json();
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const hasResumeContent = "resume_content" in body;
    const hasTemplate = "template" in body;
    const hasCoverLetterContent = "cover_letter_content" in body;
    const hasJobTitle = "job_title" in body;
    const hasFontSizePt = "font_size_pt" in body;

    if (!hasResumeContent && !hasTemplate && !hasCoverLetterContent && !hasJobTitle && !hasFontSizePt) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (hasJobTitle) {
      const jobTitle = typeof body.job_title === "string" ? body.job_title.trim() : "";
      if (!jobTitle) {
        return NextResponse.json({ error: "job_title cannot be empty" }, { status: 400 });
      }
      updates.job_title = jobTitle.slice(0, MAX_JOB_TITLE_LENGTH);
    }

    if (hasCoverLetterContent) {
      if (typeof body.cover_letter_content !== "string") {
        return NextResponse.json({ error: "cover_letter_content must be a string" }, { status: 400 });
      }
      if (body.cover_letter_content.length > MAX_COVER_LETTER_LENGTH) {
        return NextResponse.json(
          { error: `cover_letter_content must be ${MAX_COVER_LETTER_LENGTH} characters or fewer` },
          { status: 400 }
        );
      }
      updates.cover_letter_content = body.cover_letter_content;
    }

    if (hasResumeContent) {
      if (!isPlainObject(body.resume_content)) {
        return NextResponse.json(
          { error: "resume_content must be an object" },
          { status: 400 }
        );
      }
      if (!isPlainObject(body.resume_content.contact)) {
        return NextResponse.json(
          { error: "resume_content.contact must be an object" },
          { status: 400 }
        );
      }
      updates.resume_content = sanitizeResumeContent(body.resume_content);
    }

    if (hasTemplate) {
      const requestedTemplate: unknown = body.template;
      if (!isValidTemplate(requestedTemplate)) {
        return NextResponse.json({ error: "Invalid template" }, { status: 400 });
      }
      if (TEMPLATE_METADATA[requestedTemplate]?.proOnly && appUser.plan === "free") {
        return NextResponse.json(
          { error: "Upgrade to Pro to use this template" },
          { status: 403 }
        );
      }
      updates.template = canonicalTemplate(requestedTemplate);
    }


    if (hasFontSizePt) {
      const requestedFontSizePt: unknown = body.font_size_pt;
      if (!isValidFontSizePt(requestedFontSizePt)) {
        return NextResponse.json({ error: "Invalid font_size_pt" }, { status: 400 });
      }
      updates.font_size_pt = requestedFontSizePt;
    }

    const supabase = createClient();
    const { data: resume, error } = await supabase
      .from("resumes")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error || !resume) {
      return NextResponse.json({ error: error?.message ?? "Resume not found" }, { status: 404 });
    }

    return NextResponse.json({ resume });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("patch-resume error", error);
    return NextResponse.json({ error: "Failed to save resume" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { data: deleted, error } = await supabase
      .from("resumes")
      .delete()
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .select()
      .single();

    if (error || !deleted) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("delete-resume error", error);
    return NextResponse.json({ error: "Failed to delete resume" }, { status: 500 });
  }
}
