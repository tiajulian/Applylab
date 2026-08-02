import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { ApplicationStatus } from "@/types";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const STATUS_VALUES: ApplicationStatus[] = ["applied", "interviewing", "offer", "rejected"];
const MAX_COMPANY_LENGTH = 200;
const MAX_JOB_TITLE_LENGTH = 200;
const MAX_JOB_URL_LENGTH = 500;
const MAX_NOTES_LENGTH = 2000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && (STATUS_VALUES as string[]).includes(value);
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const body = await request.json().catch(() => ({}));
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("company_name" in body) {
      const companyName = typeof body.company_name === "string" ? body.company_name.trim() : "";
      if (!companyName) {
        return NextResponse.json({ error: "company_name cannot be empty" }, { status: 400 });
      }
      updates.company_name = companyName.slice(0, MAX_COMPANY_LENGTH);
    }

    if ("job_title" in body) {
      const jobTitle = typeof body.job_title === "string" ? body.job_title.trim() : "";
      if (!jobTitle) {
        return NextResponse.json({ error: "job_title cannot be empty" }, { status: 400 });
      }
      updates.job_title = jobTitle.slice(0, MAX_JOB_TITLE_LENGTH);
    }

    if ("status" in body) {
      if (!isValidStatus(body.status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = body.status;
    }

    if ("applied_date" in body) {
      if (!isValidDateString(body.applied_date)) {
        return NextResponse.json({ error: "Invalid applied_date" }, { status: 400 });
      }
      updates.applied_date = body.applied_date;
    }

    if ("job_url" in body) {
      updates.job_url =
        typeof body.job_url === "string" && body.job_url.trim()
          ? body.job_url.trim().slice(0, MAX_JOB_URL_LENGTH)
          : null;
    }

    if ("notes" in body) {
      updates.notes =
        typeof body.notes === "string" && body.notes.trim()
          ? body.notes.trim().slice(0, MAX_NOTES_LENGTH)
          : null;
    }

    if ("resume_id" in body) {
      if (body.resume_id === null) {
        updates.resume_id = null;
      } else if (typeof body.resume_id === "string" && body.resume_id) {
        const { data: resume, error: resumeError } = await supabase
          .from("resumes")
          .select("id")
          .eq("id", body.resume_id)
          .eq("user_id", authUserId)
          .single();

        if (resumeError || !resume) {
          return NextResponse.json({ error: "Resume not found" }, { status: 400 });
        }
        updates.resume_id = resume.id;
      } else {
        return NextResponse.json({ error: "Invalid resume_id" }, { status: 400 });
      }
    }

    const { data: application, error } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .select()
      .single();

    if (error || !application) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("patch-application error", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const { data: deleted, error } = await supabase
      .from("applications")
      .delete()
      .eq("id", params.id)
      .eq("user_id", authUserId)
      .select()
      .single();

    if (error || !deleted) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("delete-application error", error);
    return NextResponse.json({ error: "Failed to delete application" }, { status: 500 });
  }
}
