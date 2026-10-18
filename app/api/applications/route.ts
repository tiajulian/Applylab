import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/requireUser";
import { extensionCorsPreflight, withExtensionCors } from "@/lib/extensionCors";
import { APPLICATION_STATUSES } from "@/lib/applications/stageLabels";
import type { Application, ApplicationStatus } from "@/types";
import { parseJobUrlField } from "@/lib/url/safeHttpUrl";
import {
  cleanCompanyName,
  cleanJobTitle,
  companyFromAtsUrl,
  isPlaceholderTitle,
  jobAdUrl,
  siteNameFromUrl,
  stripSiteSuffix,
} from "@/lib/applications/jobListing";

// Uses cookies() (via requireUser/createClient) on every request, so it can never be
// statically rendered — declared explicitly to skip Next's failed static-render attempt
// (and the DYNAMIC_SERVER_USAGE console noise that comes with it) during build.
export const dynamic = "force-dynamic";

const MAX_COMPANY_LENGTH = 200;
const MAX_JOB_TITLE_LENGTH = 200;
const MAX_NOTES_LENGTH = 2000;
/** The same title + company added again within this window is treated as the same application. */
const DUPLICATE_WINDOW_DAYS = 7;

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

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

    // The Chrome extension sends what it scraped from the page. Placeholders ("Company",
    // "Manual application", the browser tab title) are never saved as a real role or employer:
    // the extension is told which details are missing and asks the user to confirm them.
    // Older, hand-installed builds don't send `source`, only their old marker note.
    const fromExtension =
      body.source === "extension" || (typeof body.notes === "string" && body.notes.startsWith("Logged via ApplyLab Co-Pilot"));
    const confirmed = body.confirmed === true;
    const pageTitle = typeof body.page_title === "string" ? body.page_title : null;
    const rawCompany = typeof body.company_name === "string" ? body.company_name : "";
    const rawTitle = typeof body.job_title === "string" ? body.job_title : "";

    // Only a real http(s) link is kept: it's rendered as a clickable link on the tracker.
    const parsedUrl = parseJobUrlField(body.job_url);
    if ("error" in parsedUrl) {
      return withExtensionCors(NextResponse.json({ error: parsedUrl.error }, { status: 400 }), request);
    }
    // The job ad itself, not an /apply/... step inside it.
    const jobUrl = fromExtension ? jobAdUrl(parsedUrl.url) : parsedUrl.url;

    const companyName = (cleanCompanyName(rawCompany) || (fromExtension ? companyFromAtsUrl(parsedUrl.url) : "")).slice(
      0,
      MAX_COMPANY_LENGTH
    );
    const jobTitle = cleanJobTitle(rawTitle, confirmed ? null : pageTitle).slice(0, MAX_JOB_TITLE_LENGTH);

    if (!companyName || !jobTitle) {
      const missing = [!jobTitle && "job title", !companyName && "company"].filter(Boolean).join(" and ");
      return withExtensionCors(
        NextResponse.json(
          {
            error: `Add the ${missing} before saving.`,
            needs_details: true,
            suggested: {
              job_title: jobTitle || (isPlaceholderTitle(stripSiteSuffix(rawTitle)) ? "" : stripSiteSuffix(rawTitle)),
              company_name: companyName,
            },
          },
          { status: fromExtension ? 422 : 400 }
        ),
        request
      );
    }

    const status: ApplicationStatus = isValidStatus(body.status) ? body.status : "applied";
    const appliedDate = isValidDateString(body.applied_date)
      ? body.applied_date
      : new Date().toISOString().slice(0, 10);

    const notes =
      !fromExtension && typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim().slice(0, MAX_NOTES_LENGTH)
        : null;

    const requestedResumeId = typeof body.resume_id === "string" && body.resume_id ? body.resume_id : null;
    const duplicateSince = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    // Independent lookups, run together: the resume is the user's own, and whether this job is
    // already tracked - the same link (e.g. "Did you apply?" answered again for the same ad), or the
    // same title and company saved again by the extension within a few days (clicked twice).
    const [resumeLookup, sameUrlLookup, sameJobLookup] = await Promise.all([
      requestedResumeId
        ? supabase.from("resumes").select("id").eq("id", requestedResumeId).eq("user_id", authUserId).single()
        : null,
      jobUrl
        ? supabase.from("applications").select("*").eq("user_id", authUserId).eq("job_url", jobUrl).limit(1).maybeSingle()
        : null,
      supabase
        .from("applications")
        .select("*")
        .eq("user_id", authUserId)
        .ilike("company_name", escapeLike(companyName))
        .ilike("job_title", escapeLike(jobTitle))
        .gte("created_at", duplicateSince)
        .limit(1)
        .maybeSingle(),
    ]);

    if (resumeLookup && (resumeLookup.error || !resumeLookup.data)) {
      return withExtensionCors(NextResponse.json({ error: "Resume not found" }, { status: 400 }), request);
    }
    const resumeId: string | null = resumeLookup?.data?.id ?? null;

    if (sameUrlLookup?.error) throw sameUrlLookup.error;
    if (sameJobLookup.error) throw sameJobLookup.error;
    // Same title and company counts as the same job only when the links don't say otherwise
    // (two "Graduate Analyst" ads at one firm, in two cities, are two applications).
    const sameJob = sameJobLookup.data as Application | null;
    const sameJobMatches = fromExtension && sameJob && (!jobUrl || !sameJob.job_url || sameJob.job_url === jobUrl);
    const existing = (sameUrlLookup?.data ?? (sameJobMatches ? sameJob : null)) as Application | null | undefined;
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
        company_name: companyName,
        job_title: jobTitle,
        status,
        applied_date: appliedDate,
        job_url: jobUrl,
        notes,
        // Only set for extension rows, so an in-app add doesn't depend on these columns.
        ...(fromExtension ? { source: "extension", source_site: siteNameFromUrl(parsedUrl.url) || null } : {}),
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
