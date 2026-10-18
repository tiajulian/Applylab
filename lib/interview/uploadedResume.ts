import type { Application, ApplicationInterview, InterviewSession, ParsedProfileFields, Resume } from "@/types";

/** "Upload my resume": practice from a resume not made in ApplyLab. */

export const MAX_UPLOADED_RESUMES = 20;
export const MAX_UPLOADED_RESUME_NAME = 80;
/** Shorter than this is a scanned image or a stray paste, not a resume. */
export const MIN_RESUME_TEXT_LENGTH = 200;
/** A job ad shorter than this gives the question writer nothing to work with. */
export const MIN_JOB_AD_TEXT_LENGTH = 100;
export const MAX_JOB_AD_TEXT_LENGTH = 20_000;
export const MAX_JOB_FIELD_LENGTH = 160;

/** Default name for a saved resume: the file name, else the latest role on it. */
export function uploadedResumeName(fileName: string | null, parsed: Pick<ParsedProfileFields, "work_experience">): string {
  const fromFile = fileName
    ?.replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const latestRole = parsed.work_experience?.[0]?.job_title?.trim();
  const name = fromFile || (latestRole ? `Resume · ${latestRole}` : "Pasted resume");
  return name.slice(0, MAX_UPLOADED_RESUME_NAME);
}

/** Groups practice for the same job: the tailored resume, else the saved resume plus the job
 *  title and company (the "This job" view on the progress chart). */
export function practiceJobKey(
  s: Pick<InterviewSession, "resume_id" | "uploaded_resume_id" | "job_title" | "company_name">
): string {
  if (s.resume_id) return s.resume_id;
  return ["upload", s.uploaded_resume_id ?? "", s.job_title ?? "", s.company_name ?? ""].join(":").toLowerCase();
}

type JobSource = Pick<InterviewSession, "resume_id"> &
  Partial<Pick<InterviewSession, "job_description" | "job_title" | "company_name">> & {
  resumes?: Pick<Resume, "job_title" | "company_name"> & Partial<Pick<Resume, "job_description">> | null;
};

/** The job a session practises for. Uploaded-resume sessions keep it on the session (it outlives
 *  the resume); tailored ones read it from their resume. */
export function sessionJob(session: JobSource): { jobTitle: string | null; companyName: string | null; jobDescription: string } {
  if (!session.resume_id) {
    return { jobTitle: session.job_title ?? null, companyName: session.company_name ?? null, jobDescription: session.job_description ?? "" };
  }
  return {
    jobTitle: session.resumes?.job_title ?? null,
    companyName: session.resumes?.company_name ?? null,
    jobDescription: session.resumes?.job_description ?? "",
  };
}

const normalise = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(pty|ltd|limited|inc|group)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The tracked application a practice is probably for: the same company and a matching title
 * (one may be a longer form of the other, "Analyst" vs "Analyst - Melbourne"). Prefers one with
 * an interview coming up, then an exact title, and returns that interview so the practice can
 * be linked to it.
 */
export function findTrackedJob(
  applications: Pick<Application, "id" | "company_name" | "job_title">[],
  interviews: Pick<ApplicationInterview, "id" | "application_id" | "outcome" | "scheduled_at">[],
  jobTitle: string,
  companyName: string,
  now = new Date()
): { application: Pick<Application, "id" | "company_name" | "job_title">; nextInterview: Pick<ApplicationInterview, "id"> | null } | null {
  const title = normalise(jobTitle);
  const company = normalise(companyName);
  if (!title || !company) return null;

  const matches = applications.filter((a) => {
    const t = normalise(a.job_title);
    return normalise(a.company_name) === company && t !== "" && (t === title || t.includes(title) || title.includes(t));
  });
  if (matches.length === 0) return null;

  const nextInterviewFor = (applicationId: string) =>
    interviews
      .filter((i) => i.application_id === applicationId && i.outcome === "scheduled" && new Date(i.scheduled_at) >= now)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] ?? null;

  // An interview coming up first, then an exact title over a longer form of it.
  const ranked = matches
    .map((application) => ({ application, nextInterview: nextInterviewFor(application.id) }))
    .sort((a, b) => Number(!a.nextInterview) - Number(!b.nextInterview) || Number(normalise(a.application.job_title) !== title) - Number(normalise(b.application.job_title) !== title));
  return ranked[0];
}
