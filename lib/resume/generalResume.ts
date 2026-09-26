/**
 * Label saved as job_title on a resume built without a job ad, so lists show something meaningful
 * instead of "Untitled". It is display-only: it is never a real target role.
 */
export const GENERAL_RESUME_TITLE = "General resume";

/** job_title as an actual target role: null for a general resume, so the label never reaches an
 * AI prompt or prefills a job-title field as if it were a role. */
export function targetJobTitle(title: string | null | undefined): string | null {
  return title && title !== GENERAL_RESUME_TITLE ? title : null;
}
