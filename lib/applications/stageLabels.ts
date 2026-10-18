import type { ApplicationStatus } from "@/types";

/**
 * Single source of truth for application status vocabulary - labels, badge colors, and which
 * statuses are "closed"/excluded from the dashboard's active pipeline funnel. Previously
 * duplicated across ApplicationsBoard.tsx, ApplicationCard.tsx, and the applications API route;
 * now all three import from here so the wording (and the set of valid values) can't drift.
 */
export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "applied",
  "interviewing",
  "offer",
  "accepted",
  "rejected",
  "withdrawn",
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Not successful",
  withdrawn: "Withdrawn",
};

export const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = APPLICATION_STATUSES.map(
  (value) => ({ value, label: STATUS_LABELS[value] })
);

export const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  "neutral" | "accent" | "success" | "attention" | "critical" | "info" | "purple"
> = {
  applied: "neutral",
  interviewing: "attention",
  offer: "success",
  accepted: "info",
  rejected: "critical",
  withdrawn: "purple",
};

/**
 * Terminal outcomes: closed out one way or another, so excluded from the dashboard's active
 * pipeline funnel (see lib/dashboard/pipeline.ts) the same way 'rejected' already was.
 */
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set(["accepted", "rejected", "withdrawn"]);

export type ApplicationColumnKey = "applied" | "interviewing" | "offer" | "finished";

/**
 * The Applications board's columns. The dashboard's Applications card counts with these same
 * groups (and links to /applications?stage=<key>), so the two pages always agree.
 */
export const APPLICATION_COLUMNS: { key: ApplicationColumnKey; statuses: ApplicationStatus[]; label: string; hint: string }[] = [
  { key: "applied", statuses: ["applied"], label: "Applied", hint: "Waiting to hear back" },
  { key: "interviewing", statuses: ["interviewing"], label: "Interviewing", hint: "You're talking to them" },
  { key: "offer", statuses: ["offer"], label: "Offer", hint: "They want you" },
  { key: "finished", statuses: ["accepted", "rejected", "withdrawn"], label: "Finished", hint: "Accepted, not successful or withdrawn" },
];

/** How many applications sit in each board column. */
export function countByColumn(applications: Array<{ status: string }>): Record<ApplicationColumnKey, number> {
  const counts: Record<ApplicationColumnKey, number> = { applied: 0, interviewing: 0, offer: 0, finished: 0 };
  for (const app of applications) {
    const column = APPLICATION_COLUMNS.find((col) => (col.statuses as string[]).includes(app.status));
    if (column) counts[column.key]++;
  }
  return counts;
}
