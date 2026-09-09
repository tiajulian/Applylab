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
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

export const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = APPLICATION_STATUSES.map(
  (value) => ({ value, label: STATUS_LABELS[value] })
);

export const STATUS_BADGE_VARIANT: Record<
  ApplicationStatus,
  "neutral" | "accent" | "success" | "attention" | "critical"
> = {
  applied: "neutral",
  interviewing: "accent",
  offer: "success",
  accepted: "success",
  rejected: "critical",
  withdrawn: "attention",
};

/**
 * Terminal outcomes: closed out one way or another, so excluded from the dashboard's active
 * pipeline funnel (see lib/dashboard/pipeline.ts) the same way 'rejected' already was.
 */
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set(["accepted", "rejected", "withdrawn"]);
