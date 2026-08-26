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
  careerProfile: "Career Profile",
} as const;

/**
 * Canonical wording for the free-tier quota, standardized on "tailored applications" (the
 * product's actual free-tier unit) so dashboard, matcher, and documents don't drift into
 * "resumes remaining" phrasing for the same count.
 */
export const QUOTA_COPY = {
  remaining: (remaining: number, limit: number) =>
    `${remaining} of ${limit} free tailored applications left`,
  exhausted: (limit: number) => `You've used your ${limit} free tailored applications.`,
} as const;
