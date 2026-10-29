import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertPaidPlan, requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { hasFillInPlaceholder } from "@/lib/resume/placeholders";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import { findingField, undoReviewChange, type ActionableFinding } from "@/lib/resume/reviewActions";
import { withReviewSpelling } from "@/lib/resume/reviewSpelling";
import { resumeReviewHash } from "@/lib/resume/reviewCache";
import { setBlockText } from "@/lib/review/blocks";
import type { Resume } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const { appUser } = await requireUser();
    assertPaidPlan(appUser);
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Choose a review suggestion first." }, { status: 400 });
    }
    const { findingId, action = "apply", fixText, expectedText } = body as Record<string, unknown>;
    if (typeof findingId !== "string" || !findingId || typeof action !== "string" || !["apply", "dismiss", "undo"].includes(action)) {
      return NextResponse.json({ error: "Choose a valid review action." }, { status: 400 });
    }
    if (action === "apply") {
      if (typeof fixText !== "string" || !fixText.trim() || fixText.length > 10000 || typeof expectedText !== "string") {
        return NextResponse.json({ error: "Preview your replacement text before applying it." }, { status: 400 });
      }
      if (hasFillInPlaceholder(fixText)) {
        return NextResponse.json({ error: "Fill in or remove the [blanks] before applying this change.", code: "PLACEHOLDERS" }, { status: 400 });
      }
    }

    const supabase = createClient();
    const { data: resume, error: fetchError } = await supabase.from("resumes").select("*")
      .eq("id", params.id).eq("user_id", appUser.id).single();
    if (fetchError || !resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    const row = resume as Resume & { review_edit_token?: string };
    if (!row.resume_content) return NextResponse.json({ error: "Resume has no content" }, { status: 400 });
    if (!row.review_edit_token) {
      return NextResponse.json({ error: "Saving review changes is temporarily unavailable. Your resume has not been changed." }, { status: 503 });
    }

    const content = sanitizeResumeContent(row.resume_content);
    const findings: ActionableFinding[] = await withReviewSpelling(content, row.review_findings ?? []);
    const finding = findings.find((f) => f.id === findingId);
    if (!finding) return NextResponse.json({ error: "This suggestion is out of date. Check your resume again." }, { status: 409 });

    let nextContent = content;
    let nextFinding: ActionableFinding;
    if (action === "undo") {
      if (finding.status === "dismissed") {
        nextFinding = { ...finding, status: "open" };
      } else if (finding.status === "applied") {
        const restored = undoReviewChange(content, finding);
        if (!restored) return NextResponse.json({ error: "This text has changed since the fix. Undo would overwrite your edits, so nothing was changed." }, { status: 409 });
        nextContent = restored;
        nextFinding = { ...finding, status: "open", review_change: undefined };
      } else {
        return NextResponse.json({ error: "There is no change to undo." }, { status: 409 });
      }
    } else {
      if (finding.status === "applied" || finding.status === "dismissed") {
        return NextResponse.json({ error: "This suggestion has already been handled. Refresh the page to see the latest version." }, { status: 409 });
      }
      if (action === "dismiss") {
        nextFinding = { ...finding, status: "dismissed" };
      } else {
        const field = findingField(content, finding);
        if (!field || field.text !== expectedText) {
          return NextResponse.json({ error: "This text has changed since the suggestion. Check your resume again before replacing it." }, { status: 409 });
        }
        const after = (fixText as string).trim();
        if (after === field.text) return NextResponse.json({ error: "Make a change first, or choose Keep mine." }, { status: 400 });
        nextContent = setBlockText(content, field.id, after);
        nextFinding = { ...finding, status: "applied", review_change: { blockId: field.id, before: field.text, after } };
      }
    }

    if (nextContent !== content && !await saveVersionSnapshot(supabase, row.id, content, action === "undo" ? "Before undoing review change" : "Before review change")) {
      return NextResponse.json({ error: "We couldn't save a backup. Your resume has not been changed. Please try again." }, { status: 503 });
    }
    const updatedFindings = findings.map((f) => f.id === findingId ? nextFinding : f);
    // The generated token changes with content/findings, including writes from other editor tabs.
    const { data: updated, error: updateError } = await createServiceRoleClient().from("resumes").update({
      ...(nextContent !== content ? { resume_content: nextContent } : {}),
      review_findings: updatedFindings,
    }).eq("id", row.id).eq("user_id", appUser.id).eq("review_edit_token", row.review_edit_token)
      .select().maybeSingle();
    if (updateError) return NextResponse.json({ error: "We couldn't save this change. Your draft is still here. Please try again." }, { status: 500 });
    if (!updated) return NextResponse.json({ error: "Your resume changed in another tab. Refresh the page before trying again." }, { status: 409 });

    return NextResponse.json({
      resume: updated,
      findings: await withReviewSpelling(nextContent, updatedFindings),
      isStale: updated.review_content_hash !== resumeReviewHash(nextContent, updated.job_description ?? ""),
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (error instanceof PaidFeatureError) return NextResponse.json({ error: "Upgrade to Pro to apply fixes" }, { status: 403 });
    console.error("Review action failed", error);
    return NextResponse.json({ error: "We couldn't save this change. Please try again." }, { status: 500 });
  }
}
