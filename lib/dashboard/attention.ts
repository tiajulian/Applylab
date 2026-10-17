import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  diffCalendarDaysMelbourne,
  formatRelativeDistanceMelbourne,
  formatEnAuDate,
  getMelbourneParts,
  getMelbourneDateString,
} from "@/lib/dateUtils";
import { TERMINAL_STATUSES } from "@/lib/applications/stageLabels";
import { FOLLOWUP_REMINDER_DAYS, GOOD_INTERVIEW_FOLLOWUP_DAYS } from "@/lib/dashboard/followupConfig";
import type { ApplicationStatus } from "@/types";

export type AttentionItemType =
  | "upcoming_interview"
  | "closing_soon"
  | "followup_due"
  | "outcome_needed";

export interface AttentionItem {
  id: string;
  type: AttentionItemType;
  urgencyWeight: number; // Higher number = more urgent
  title: string;
  subtitle: string;
  badgeLabel: string;
  badgeVariant: "critical" | "attention" | "accent";
  actionLabel: string;
  actionHref?: string;
  applicationId?: string;
  interviewId?: string;
  companyName: string;
  jobTitle: string;
}

/** application_interviews columns evaluateAttentionItems reads. */
export const INTERVIEW_COLUMNS =
  "id, application_id, stage_type, scheduled_at, outcome, result, result_recorded_at, ask_again_at";

const STAGE_LABELS: Record<string, string> = {
  phone_screen: "Phone screen",
  technical: "Technical interview",
  panel: "Panel interview",
  async_video: "Async video interview",
  group: "Assessment centre",
  general: "Behavioural interview",
  coding: "Coding interview",
};

/** Who a to-do is about: the company, else the job title. Never a generic "Company". */
function displayName(app: { company_name?: string | null; job_title?: string | null } | undefined): string {
  return app?.company_name?.trim() || app?.job_title?.trim() || "this job";
}

export function evaluateAttentionItems(
  applications: Array<{
    id: string;
    company_name: string;
    job_title: string;
    status: string;
    applied_date?: string | null;
  }>,
  interviews: Array<{
    id: string;
    application_id: string;
    stage_type: string;
    scheduled_at: string;
    outcome: string;
    result?: string | null;
    result_recorded_at?: string | null;
    ask_again_at?: string | null;
  }>,
  followups: Array<{
    id: string;
    application_id: string;
    created_at: string;
    copied_at?: string | null;
  }>,
  parsedJobAds: Array<{
    application_id?: string;
    job_title?: string;
    company_name?: string;
    closes_at?: string | null;
  }>,
  baseDate: Date = new Date()
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = baseDate;
  const nowMs = now.getTime();
  const appsById = new Map(applications.map((app) => [app.id, app]));
  const roundsByApp = new Map<string, typeof interviews>();
  for (const interview of interviews) {
    const rounds = roundsByApp.get(interview.application_id);
    if (rounds) rounds.push(interview);
    else roundsByApp.set(interview.application_id, [interview]);
  }

  // 1. Upcoming interviews (within next 7 days) -> Event title + "Practise round" action
  for (const interview of interviews) {
    if (interview.outcome === "scheduled") {
      const interviewTime = new Date(interview.scheduled_at).getTime();
      const daysUntil = diffCalendarDaysMelbourne(interview.scheduled_at, now);

      if (interviewTime >= nowMs && daysUntil >= 0 && daysUntil <= 7) {
        const app = applications.find((a) => a.id === interview.application_id);
        const companyName = app?.company_name || "";
        const jobTitle = app?.job_title || "";
        const stageLabel = STAGE_LABELS[interview.stage_type] || "Interview";
        const relativeTime = formatRelativeDistanceMelbourne(interview.scheduled_at, now);
        const weekday = getMelbourneParts(interview.scheduled_at).weekday;

        const timeClause = daysUntil === 0 ? "today" : daysUntil === 1 ? "tomorrow" : `on ${weekday}`;
        const eventTitle = `${stageLabel} with ${displayName(app)} ${timeClause}`;

        items.push({
          id: `practice-${interview.id}`,
          type: "upcoming_interview",
          urgencyWeight: daysUntil <= 1 ? 95 : 85,
          title: eventTitle,
          subtitle: `Interview ${relativeTime}`,
          badgeLabel: daysUntil === 0 ? "Interview today" : daysUntil === 1 ? "Interview tomorrow" : "Upcoming interview",
          badgeVariant: "accent",
          actionLabel: "Practise for it \u2192",
          actionHref: `/interview?application=${interview.application_id}&stage=${interview.stage_type}&interview=${interview.id}`,
          applicationId: interview.application_id,
          interviewId: interview.id,
          companyName,
          jobTitle,
        });
      }
    }
  }

  // 2. How did it go? A round whose time has passed and that's still marked scheduled. Skipped
  // for closed applications, and while a "Not sure yet" snooze (ask_again_at) is running.
  for (const interview of interviews) {
    if (interview.outcome !== "scheduled" || new Date(interview.scheduled_at).getTime() >= nowMs) continue;
    if (interview.ask_again_at && new Date(interview.ask_again_at).getTime() > nowMs) continue;
    const app = appsById.get(interview.application_id);
    if (app && TERMINAL_STATUSES.has(app.status as ApplicationStatus)) continue;
    const stageLabel = (STAGE_LABELS[interview.stage_type] || "Interview").toLowerCase();

    items.push({
      id: `outcome-${interview.id}`,
      type: "outcome_needed",
      urgencyWeight: 80,
      title: `How did your ${stageLabel} with ${displayName(app)} go?`,
      subtitle: "",
      badgeLabel: "Outcome needed",
      badgeVariant: "attention",
      actionLabel: "",
      applicationId: interview.application_id,
      interviewId: interview.id,
      companyName: app?.company_name || "",
      jobTitle: app?.job_title || "",
    });
  }

  // 3. Follow up: FOLLOWUP_REMINDER_DAYS after the latest interview (or after applying, if there
  // hasn't been one), or GOOD_INTERVIEW_FOLLOWUP_DAYS after the user said it went well. A
  // follow-up only counts as done if it was written after that interview or application.
  const lastFollowupAt = new Map<string, number>();
  for (const followup of followups) {
    const at = new Date(followup.created_at).getTime();
    if (at > (lastFollowupAt.get(followup.application_id) ?? -Infinity)) lastFollowupAt.set(followup.application_id, at);
  }

  for (const app of applications) {
    if (app.status !== "applied" && app.status !== "interviewing") continue;

    const rounds = (roundsByApp.get(app.id) ?? []).filter((i) => i.outcome !== "cancelled");
    const latestRound = rounds
      .filter((i) => new Date(i.scheduled_at).getTime() < nowMs)
      .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime())[0];

    let eventAt: string;
    let due: boolean;
    let subtitle: string;
    if (latestRound) {
      const daysAgo = -diffCalendarDaysMelbourne(latestRound.scheduled_at, now);
      const wentWellAt = latestRound.result === "well" ? latestRound.result_recorded_at : null;
      eventAt = latestRound.scheduled_at;
      due = wentWellAt
        ? -diffCalendarDaysMelbourne(wentWellAt, now) >= GOOD_INTERVIEW_FOLLOWUP_DAYS
        : daysAgo >= FOLLOWUP_REMINDER_DAYS;
      subtitle = `Your interview was ${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
    } else if (app.status === "applied" && app.applied_date && rounds.length === 0) {
      // No interview yet (an upcoming one means they've already replied, so no nudge).
      const daysAgo = -diffCalendarDaysMelbourne(app.applied_date, now);
      eventAt = app.applied_date;
      due = daysAgo >= FOLLOWUP_REMINDER_DAYS;
      subtitle = `You applied ${daysAgo} ${daysAgo === 1 ? "day" : "days"} ago`;
    } else {
      continue;
    }

    if (!due || (lastFollowupAt.get(app.id) ?? -Infinity) >= new Date(eventAt).getTime()) continue;

    items.push({
      id: `followup-${app.id}`,
      type: "followup_due",
      urgencyWeight: latestRound ? 60 : 50,
      title: `Follow up with ${displayName(app)}`,
      subtitle,
      badgeLabel: "Follow-up due",
      badgeVariant: "accent",
      actionLabel: "Write a follow-up \u2192",
      applicationId: app.id,
      companyName: app.company_name,
      jobTitle: app.job_title,
    });
  }

  // 4. Closing soon (< 48h / <= 2 days)
  for (const ad of parsedJobAds) {
    if (ad.closes_at) {
      const daysUntil = diffCalendarDaysMelbourne(ad.closes_at, now);
      if (daysUntil >= 0 && daysUntil <= 2) {
        const companyName = ad.company_name || "";
        const jobTitle = ad.job_title || "";
        const isToday = daysUntil === 0;
        const isTomorrow = daysUntil === 1;
        const timeClause = isToday ? "closes today" : isTomorrow ? "closes tomorrow" : "closes soon";

        const eventTitle = `${displayName(ad)} application ${timeClause}`;

        items.push({
          id: `closing-${ad.application_id || ad.closes_at}`,
          type: "closing_soon",
          urgencyWeight: isToday ? 100 : 70,
          title: eventTitle,
          subtitle: "Application deadline approaching",
          badgeLabel: isToday ? "Closes today" : "Closes soon",
          badgeVariant: isToday ? "critical" : "attention",
          actionLabel: "Review & apply \u2192",
          actionHref: ad.application_id ? `/applications` : `/documents`,
          applicationId: ad.application_id,
          companyName,
          jobTitle,
        });
      }
    }
  }

  // Sort by urgency weight descending
  items.sort((a, b) => b.urgencyWeight - a.urgencyWeight);

  // Cap at 5 items
  return items.slice(0, 5);
}

/**
 * Calculates the widened DB pre-filter date range [today - 1 day, today + 3 days] in Melbourne time.
 * This pre-filter window is strictly wider than the JS evaluation window [today, today + 2 days]
 * (0 <= daysUntil <= 2) to ensure no boundary, timezone, or end-of-day timestamps are clipped by the DB.
 */
export function getAttentionClosesAtBounds(baseDate: Date = new Date()): { minDate: string; maxDate: string } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const minDate = getMelbourneDateString(new Date(baseDate.getTime() - msPerDay));
  const maxDate = getMelbourneDateString(new Date(baseDate.getTime() + 3 * msPerDay));
  return { minDate, maxDate };
}

/**
 * parsed_job_ads is a global cache shared and readable by every user (RLS: "using (true)"), not
 * scoped to the current request's user - so unlike everything else on the dashboard, this query
 * result can be safely reused across every visitor's page load. Wrapped in unstable_cache with a
 * short TTL rather than the request-scoped supabase client (which would need cookies() and can't
 * be called inside unstable_cache) - a closing-soon reminder being up to a minute stale is a fine
 * trade for cutting this from "one query per dashboard load, for every user" to "one query per
 * minute, for the whole app".
 */
const getClosingSoonJobAds = unstable_cache(
  async (minDate: string, maxDate: string) => {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("parsed_job_ads")
      .select("title, company, closes_at, closes_at_state")
      .not("closes_at", "is", null)
      .gte("closes_at", minDate)
      .lte("closes_at", maxDate);
    return data ?? [];
  },
  ["dashboard-closing-soon-job-ads"],
  { revalidate: 60 }
);

export async function getClosingSoonAds(): Promise<
  Array<{ job_title: string; company_name: string; closes_at: string | null }>
> {
  const { minDate, maxDate } = getAttentionClosesAtBounds();
  const parsedJobAds = await getClosingSoonJobAds(minDate, maxDate);
  return parsedJobAds.map((ad) => ({
    job_title: ad.title,
    company_name: ad.company,
    closes_at: ad.closes_at,
  }));
}

export async function getAttentionItems(
  supabase: SupabaseClient,
  userId: string
): Promise<AttentionItem[]> {
  const [
    { data: applications },
    { data: interviews },
    { data: followups },
    mappedAds,
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company_name, job_title, status, applied_date")
      .eq("user_id", userId),
    supabase
      .from("application_interviews")
      .select(`${INTERVIEW_COLUMNS}, applications!inner(user_id)`)
      .eq("applications.user_id", userId),
    supabase
      .from("application_followups")
      .select("id, application_id, created_at, copied_at")
      .eq("user_id", userId),
    getClosingSoonAds(),
  ]);

  return evaluateAttentionItems(
    applications ?? [],
    interviews ?? [],
    followups ?? [],
    mappedAds
  );
}
