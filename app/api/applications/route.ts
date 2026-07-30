import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import type { ApplicationStatus } from "@/types";

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
    const { authUserId } = await requireUser();
    const supabase = createClient();

    const body = await request.json().catch(() => ({}));
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: "Request body must be an object" }, { status: 400 });
    }

    const companyName = typeof body.company_name === "string" ? body.company_name.trim() : "";
    const jobTitle = typeof body.job_title === "string" ? body.job_title.trim() : "";

    if (!companyName || !jobTitle) {
      return NextResponse.json(
        { error: "company_name and job_title are required" },
        { status: 400 }
      );
    }

    const status: ApplicationStatus = isValidStatus(body.status) ? body.status : "applied";
    const appliedDate = isValidDateString(body.applied_date)
      ? body.applied_date
      : new Date().toISOString().slice(0, 10);

    const jobUrl =
      typeof body.job_url === "string" && body.job_url.trim()
        ? body.job_url.trim().slice(0, MAX_JOB_URL_LENGTH)
        : null;
    const notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim().slice(0, MAX_NOTES_LENGTH)
        : null;

    let resumeId: string | null = null;
    if (typeof body.resume_id === "string" && body.resume_id) {
      const { data: resume, error: resumeError } = await supabase
        .from("resumes")
        .select("id")
        .eq("id", body.resume_id)
        .eq("user_id", authUserId)
        .single();

      if (resumeError || !resume) {
        return NextResponse.json({ error: "Resume not found" }, { status: 400 });
      }
      resumeId = resume.id;
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
      return NextResponse.json(
        { error: error?.message ?? "Failed to create application" },
        { status: 500 }
      );
    }

    return NextResponse.json({ application });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("create-application error", error);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
