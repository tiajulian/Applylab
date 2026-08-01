import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { isValidTemplate, TEMPLATE_METADATA } from "@/lib/resume/templateMetadata";
import type {
  ResumeContact,
  ResumeContent,
  ResumeEducationEntry,
  ResumeExperienceEntry,
  ResumeProjectEntry,
  ResumeReferee,
} from "@/types";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function asRecord(entry: unknown): Record<string, unknown> {
  return typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : {};
}

function sanitizeContact(value: unknown): ResumeContact {
  const record = asRecord(value);
  return {
    name: asString(record.name),
    phone: asString(record.phone),
    email: asString(record.email),
    location: asString(record.location),
    linkedin: asString(record.linkedin),
    work_rights: asString(record.work_rights),
  };
}

function sanitizeExperience(value: unknown): ResumeExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      job_title: asString(entry.job_title),
      company: asString(entry.company),
      company_description: asString(entry.company_description),
      location: asString(entry.location),
      start_date: asString(entry.start_date),
      end_date: asString(entry.end_date),
      bullets: asStringArray(entry.bullets),
    };
  });
}

function sanitizeEducation(value: unknown): ResumeEducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      degree: asString(entry.degree),
      institution: asString(entry.institution),
      year: asString(entry.year),
      notes: asString(entry.notes),
    };
  });
}

function sanitizeReferees(value: unknown): ResumeReferee[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      name: asString(entry.name),
      title: asString(entry.title),
      organisation: asString(entry.organisation),
      phone: asString(entry.phone),
      email: asString(entry.email),
    };
  });
}

function sanitizeProjects(value: unknown): ResumeProjectEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((raw) => {
    const entry = asRecord(raw);
    return {
      title: asString(entry.title),
      context: asString(entry.context),
      year: asString(entry.year),
      bullets: asStringArray(entry.bullets),
    };
  });
}

function sanitizeResumeContent(value: unknown): ResumeContent {
  const record = asRecord(value);
  return {
    contact: sanitizeContact(record.contact),
    target_titles: asStringArray(record.target_titles),
    summary: asString(record.summary),
    skills: asStringArray(record.skills),
    tools: asStringArray(record.tools),
    experience: sanitizeExperience(record.experience),
    projects: sanitizeProjects(record.projects),
    education: sanitizeEducation(record.education),
    referees: sanitizeReferees(record.referees),
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const MAX_COVER_LETTER_LENGTH = 20_000;

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

    if (!hasResumeContent && !hasTemplate && !hasCoverLetterContent) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

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
      if (TEMPLATE_METADATA[requestedTemplate].proOnly && appUser.plan === "free") {
        return NextResponse.json(
          { error: "Upgrade to Pro to use this template" },
          { status: 403 }
        );
      }
      updates.template = requestedTemplate;
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
