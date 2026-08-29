import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertPaidPlan, requireUser, UnauthorizedError, PaidFeatureError } from "@/lib/requireUser";
import { sanitizeResumeContent } from "@/lib/resume/sanitizeResumeContent";
import { sanitizeDeep } from "@/lib/text/sanitizeDashes";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import type { FactCheckTarget, Resume, ResumeContent, ResumeReviewFinding } from "@/types";

export const dynamic = "force-dynamic";

function normalizeForMatch(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { appUser } = await requireUser();
    assertPaidPlan(appUser);

    const supabase = createClient();
    const body = await request.json().catch(() => ({}));
    const { findingId, fixText, target, bulletText } = body as {
      findingId?: string;
      fixText?: string;
      target?: FactCheckTarget;
      bulletText?: string;
    };

    if (!findingId || !fixText || typeof fixText !== "string" || !fixText.trim()) {
      return NextResponse.json({ error: "findingId and fixText are required" }, { status: 400 });
    }

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const resumeRow = resume as Resume;
    if (!resumeRow.resume_content) {
      return NextResponse.json({ error: "Resume has no content" }, { status: 400 });
    }

    const currentContent = sanitizeResumeContent(resumeRow.resume_content);
    let nextContent: ResumeContent = { ...currentContent };
    let fixApplied = false;

    // 1. Direct target replacement if valid target pointer exists
    if (target) {
      if (target.kind === "summary") {
        nextContent = { ...nextContent, summary: fixText.trim() };
        fixApplied = true;
      } else if (
        target.kind === "experienceBullet" &&
        nextContent.experience[target.index]?.bullets[target.bulletIndex] !== undefined
      ) {
        nextContent = {
          ...nextContent,
          experience: nextContent.experience.map((entry, i) =>
            i === target.index
              ? {
                  ...entry,
                  bullets: entry.bullets.map((b, bi) => (bi === target.bulletIndex ? fixText.trim() : b)),
                }
              : entry
          ),
        };
        fixApplied = true;
      } else if (
        target.kind === "projectBullet" &&
        nextContent.projects[target.index]?.bullets[target.bulletIndex] !== undefined
      ) {
        nextContent = {
          ...nextContent,
          projects: nextContent.projects.map((entry, i) =>
            i === target.index
              ? {
                  ...entry,
                  bullets: entry.bullets.map((b, bi) => (bi === target.bulletIndex ? fixText.trim() : b)),
                }
              : entry
          ),
        };
        fixApplied = true;
      }
    }

    // 2. Fuzzy bulletText match fallback
    if (!fixApplied && bulletText) {
      const normalizedTarget = normalizeForMatch(bulletText);
      for (let e = 0; e < nextContent.experience.length; e++) {
        const bulletIndex = nextContent.experience[e].bullets.findIndex(
          (b) => normalizeForMatch(b) === normalizedTarget
        );
        if (bulletIndex !== -1) {
          nextContent = {
            ...nextContent,
            experience: nextContent.experience.map((entry, i) =>
              i === e
                ? {
                    ...entry,
                    bullets: entry.bullets.map((b, j) => (j === bulletIndex ? fixText.trim() : b)),
                  }
                : entry
            ),
          };
          fixApplied = true;
          break;
        }
      }
    }

    if (!fixApplied) {
      return NextResponse.json(
        { error: "Could not locate the exact element to apply this fix to (content may have changed)." },
        { status: 400 }
      );
    }

    nextContent = sanitizeDeep(nextContent);

    // Save version snapshot before overwriting
    await saveVersionSnapshot(supabase, resumeRow.id, currentContent, "Before AI review fix");

    // Update finding status
    const existingFindings = (resumeRow.review_findings ?? []) as ResumeReviewFinding[];
    const updatedFindings = existingFindings.map((f) => (f.id === findingId ? { ...f, status: "applied" as const } : f));

    const { data: updated, error: updateError } = await createServiceRoleClient()
      .from("resumes")
      .update({
        resume_content: nextContent,
        review_findings: updatedFindings,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: "Failed to apply review fix" }, { status: 500 });
    }

    return NextResponse.json({
      resume: updated,
      findings: updatedFindings,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof PaidFeatureError) {
      return NextResponse.json({ error: "Upgrade to Pro to apply fixes" }, { status: 403 });
    }
    console.error("apply-fix error", error);
    return NextResponse.json({ error: "Failed to apply fix" }, { status: 500 });
  }
}
