import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { extensionCorsPreflight, withExtensionCors } from "@/lib/extensionCors";
import { APPLICATION_STATUSES } from "@/lib/applications/stageLabels";
import type { Application, ApplicationStatus } from "@/types";
import { parseJobUrlField } from "@/lib/url/safeHttpUrl";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const MAX_COMPANY_LENGTH = 200;
const MAX_JOB_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (APPLICATION_STATUSES as string[]).includes(value);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

export async function OPTIONS(request: Request) {
  return extensionCorsPreflight(request);
}

export async function GET() {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { data: applications, error } = await supabase
      .from("applications")
      .select("*")
      .eq("user_id", authUserId)
      .order("applied_date", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ applications: applications ?? [] });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("list-applications error", error);
    return NextResponse.json({ error: "Failed to load applications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { authUserId } = await requireUser(request);
    const supabase = createClient();

    const body = await request.json().catch(() => ({}));
    if (!isPlainObject(body)) {
      return withExtensionCors(NextResponse.json({ error: "Request body must be an object" }, { status: 400 }), request);
    }

    const companyName = typeof body.company_name === "string" ? body.company_name.trim() : "";
    const jobTitle = typeof body.job_title === "string" ? body.job_title.trim() : "";

    if (!companyName || !jobTitle) {
      return withExtensionCors(
        NextResponse.json({ error: "company_name and job_title are required" }, { status: 400 }),
        request
      );
    }

    const status: ApplicationStatus = isValidStatus(body.status) ? body.status : "applied";
    const appliedDate = isValidDateString(body.applied_date)
      ? body.applied_date
      : new Date().toISOString().slice(0, 10);

    // Only a real http(s) link is kept: it's rendered as a clickable link on the tracker.
    const parsedUrl = parseJobUrlField(body.job_url);
    if ("error" in parsedUrl) {
      return withExtensionCors(NextResponse.json({ error: parsedUrl.error }, { status: 400 }), request);
    }
    const jobUrl = parsedUrl.url;
    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim().slice(0, MAX_NOTES_LENGTH)
        : null;

    const requestedResumeId = typeof body.resume_id === "string" && body.resume_id ? body.resume_id : null;
    // Independent lookups, run together: the resume is the user's own, and whether this job link is
    // already tracked (e.g. "Did you apply?" answered again for the same ad).
    const [resumeLookup, existingLookup] = await Promise.all([
      requestedResumeId
        ? supabase.from("resumes").select("id").eq("id", requestedResumeId).eq("user_id", authUserId).single()
        : null,
      jobUrl
        ? supabase.from("applications").select("*").eq("user_id", authUserId).eq("job_url", jobUrl).limit(1).maybeSingle()
        : null,
    ]);

    if (resumeLookup && (resumeLookup.error || !resumeLookup.data)) {
      return withExtensionCors(NextResponse.json({ error: "Resume not found" }, { status: 400 }), request);
    }
    const resumeId: string | null = resumeLookup?.data?.id ?? null;

    if (existingLookup?.error) throw existingLookup.error;
    const existing = existingLookup?.data as Application | null | undefined;
    if (existing) {
      // Same job, same application: no duplicate. A tailored resume sent now is linked if none was.
      if (resumeId && !existing.resume_id) {
        const { data: updated, error: updateError } = await supabase
          .from("applications")
          .update({ resume_id: resumeId })
          .eq("id", existing.id)
          .eq("user_id", authUserId)
          .select()
          .single();
        if (updateError) throw updateError;
        return withExtensionCors(NextResponse.json({ application: updated, existing: true }), request);
      }
      return withExtensionCors(NextResponse.json({ application: existing, existing: true }), request);
    }

    const { data: application, error } = await supabase
      .from("applications")
      .insert({
        user_id: authUserId,
        resume_id: resumeId,
        company_name: companyName.slice(0, MAX_COMPANY_LENGTH),
        job_title: jobTitle.slice(0, MAX_JOB_TITLE_LENGTH),
        status,
        applied_date: appliedDate,
        job_url: jobUrl,
        notes,
      })
      .select()
      .single();

    if (error || !application) {
      return withExtensionCors(
        NextResponse.json({ error: error?.message ?? "Failed to create application" }, { status: 500 }),
        request
      );
    }

    return withExtensionCors(NextResponse.json({ application }), request);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return withExtensionCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
    }
    console.error("create-application error", error);
    return withExtensionCors(NextResponse.json({ error: "Failed to create application" }, { status: 500 }), request);
  }
}
