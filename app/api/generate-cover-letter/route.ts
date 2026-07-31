import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCoverLetter } from "@/lib/anthropic/generateCoverLetter";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { Resume } from "@/types";

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
// See generate-resume/route.ts for why 60 wasn't enough (confirmed in production).
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser();

    const { resumeId } = await request.json();

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

    if (!resumeRow.resume_content) {
      return NextResponse.json(
        { error: "Resume must be generated before creating a cover letter" },
        { status: 400 }
      );
    }

    const coverLetter = await generateCoverLetter({
      jobDescription: resumeRow.job_description,
      jobTitle: resumeRow.job_title ?? "",
      companyName: resumeRow.company_name ?? "",
      resumeContent: resumeRow.resume_content,
    }, authUserId);

    const { error: updateError } = await supabase
      .from("resumes")
      .update({ cover_letter_content: coverLetter })
      .eq("id", resumeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ coverLetter });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("generate-cover-letter error", error);
    return NextResponse.json({ error: "Failed to generate cover letter" }, { status: 500 });
  }
}
