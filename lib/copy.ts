/**
 * Canonical labels for the four concepts that were previously worded differently across
 * nav, tiles, empty states, and buttons (e.g. "New resume" / "Tailor New Resume" / "Create
 * your first resume" all meant the same action). Import these instead of inlining variants.
 */
export const NAV_COPY = {
  newResume: "New resume",
  documents: "Documents",
  viewAllDocuments: "View all",
  interview: "Interview",
  careerProfile: "Your profile",
} as const;

const tailoredResumes = (n: number) => `tailored resume${n === 1 ? "" : "s"}`;

/**
 * Canonical wording for the free-tier quota, "tailored resumes" to match the marketing site and
 * pricing (lib/marketing/plans.ts), so dashboard, matcher, and documents use the same unit.
 */
export const QUOTA_COPY = {
  remaining: (remaining: number, limit: number) =>
    `${remaining} of ${limit} free ${tailoredResumes(limit)} left`,
  exhausted: (limit: number) =>
    limit === 1 ? "You've used your free tailored resume." : `You've used your ${limit} free tailored resumes.`,
} as const;
