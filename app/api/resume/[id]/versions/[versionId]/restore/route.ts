import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import type { Resume, ResumeVersion } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: { id: string; versionId: string } }
) {
  try {
    await requireUser();
    const supabase = createClient();

    const { data: resume, error: resumeError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (resumeError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    const resumeRow = resume as Resume;

    // Scoping by both id and resume_id guards against restoring a version that belongs to a
    // different resume (even one owned by the same user), not just cross-user access.
    const { data: version, error: versionError } = await supabase
      .from("resume_versions")
      .select("*")
      .eq("id", params.versionId)
      .eq("resume_id", params.id)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }
    const versionRow = version as ResumeVersion;

    // Snapshot the current state first so restoring is itself reversible.
    if (resumeRow.resume_content) {
      await saveVersionSnapshot(supabase, params.id, sanitizeResumeContent(resumeRow.resume_content), "Before restore");
    }

    // The content score is an assertion about these specific bytes — once resume_content
    // changes underneath it, the stored score describes content that no longer exists, which
    // is worse than no score at all. Clear the score/breakdown/issues, but deliberately leave
    // content_score_count untouched: a restore-then-rescore is a fresh unit of Anthropic spend
    // against different content, so it should still cost a free-tier scan rather than handing
    // out an unlimited free re-score via a restore loop.
    // content_score-family columns are intentionally not client-writable (see
    // supabase/schema.sql column-privilege lockdown) — ownership was already verified by the
    // RLS-scoped select above, so writing them via service-role here is safe.
    const { data: updated, error: updateError } = await createServiceRoleClient()
      .from("resumes")
      .update({
        // The snapshot being restored can itself predate a ResumeContent schema change (an old
        // version saved before target_titles/tools/projects existed) - normalize it going back
        // in, both so the stored row is healed and so the client, which sets its resume state
        // directly from this response, never receives a shape its own templates can't render.
        resume_content: sanitizeResumeContent(versionRow.snapshot),
        content_score: null,
        content_score_breakdown: null,
        content_score_issues: [],
        content_score_content_hash: null,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: updateError?.message ?? "Failed to restore version" },
        { status: 500 }
      );
    }

    return NextResponse.json({ resume: updated });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("restore-version error", error);
    return NextResponse.json({ error: "Failed to restore version" }, { status: 500 });
  }
}
