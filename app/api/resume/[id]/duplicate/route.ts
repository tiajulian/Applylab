import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { retailorResume } from "@/lib/anthropic/retailorResume";
import { saveVersionSnapshot } from "@/lib/resume/versions";
import {
  FreeLimitReachedError,
  refundResumeGeneration,
  requireUser,
  reserveResumeGeneration,
  UnauthorizedError,
} from "@/lib/requireUser";
import type { Resume } from "@/types";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Give the Claude call (with its own retries) room to finish before Vercel kills the invocation.
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  let reservedForUserId: string | null = null;

  try {
    const { authUserId, appUser } = await requireUser();

    const body = await request.json();
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const { jobTitle, companyName, jobDescription } = body;
    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json({ error: "jobDescription is required" }, { status: 400 });
    }

    const { data: original, error: fetchError } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !original) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    const originalRow = original as Resume;
    if (!originalRow.resume_content) {
      return NextResponse.json(
        { error: "Original resume has no content to duplicate" },
        { status: 400 }
      );
    }

    await reserveResumeGeneration(supabase, appUser);
    reservedForUserId = authUserId;

    const retailored = await retailorResume(originalRow.resume_content, {
      jobTitle: typeof jobTitle === "string" ? jobTitle : "",
      companyName: typeof companyName === "string" ? companyName : "",
      jobDescription,
    });

    const { data: newResume, error: insertError } = await supabase
      .from("resumes")
      .insert({
        user_id: authUserId,
        job_description: jobDescription,
        job_title: typeof jobTitle === "string" ? jobTitle : null,
        company_name: typeof companyName === "string" ? companyName : null,
        resume_content: retailored,
        template: originalRow.template,
      })
      .select()
      .single();

    if (insertError || !newResume) {
      await refundResumeGeneration(supabase, reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
      return NextResponse.json(
        { error: insertError?.message ?? "Failed to duplicate resume" },
        { status: 500 }
      );
    }

    await saveVersionSnapshot(supabase, newResume.id, retailored, "Duplicated & re-tailored");

    return NextResponse.json({ resume: newResume });
  } catch (error) {
    if (reservedForUserId) {
      await refundResumeGeneration(supabase, reservedForUserId).catch((refundError) =>
        console.error("failed to refund resume generation reservation", refundError)
      );
    }

    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof FreeLimitReachedError) {
      return NextResponse.json({ error: "Free resume limit reached" }, { status: 403 });
    }
    console.error("duplicate-resume error", error);
    return NextResponse.json({ error: "Failed to duplicate resume" }, { status: 500 });
  }
}
