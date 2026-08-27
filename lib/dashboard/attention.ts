import type { SupabaseClient } from "@supabase/supabase-js";
import { diffCalendarDaysMelbourne, formatRelativeDistanceMelbourne } from "@/lib/dateUtils";

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

const STAGE_NAMES: Record<string, string> = {
  phone_screen: "phone screen",
  technical: "technical",
  panel: "panel",
  async_video: "async video",
  group: "assessment centre",
  general: "behavioural",
};

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
  }>
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const now = new Date();
  const nowMs = now.getTime();

  // 1. Upcoming interviews (within next 7 days) -> "Practise {stage} round"
  for (const interview of interviews) {
    if (interview.outcome === "scheduled") {
      const interviewTime = new Date(interview.scheduled_at).getTime();
      const daysUntil = diffCalendarDaysMelbourne(interview.scheduled_at, now);

      if (interviewTime >= nowMs && daysUntil >= 0 && daysUntil <= 7) {
        const app = applications.find((a) => a.id === interview.application_id);
        const companyName = app?.company_name || "Company";
        const jobTitle = app?.job_title || "Role";
        const stageLabel = STAGE_NAMES[interview.stage_type] || interview.stage_type;
        const relativeTime = formatRelativeDistanceMelbourne(interview.scheduled_at, now);

        items.push({
          id: `practice-${interview.id}`,
          type: "upcoming_interview",
          urgencyWeight: daysUntil <= 1 ? 95 : 85,
          title: `Practise ${stageLabel} round for ${jobTitle}`,
          subtitle: `${companyName} • Interview ${relativeTime}`,
          badgeLabel: daysUntil === 0 ? "Interview today" : daysUntil === 1 ? "Interview tomorrow" : "Upcoming interview",
          badgeVariant: "accent",
          actionLabel: `Practise ${stageLabel} round →`,
          actionHref: `/interview?application=${interview.application_id}&stage=${interview.stage_type}&interview=${interview.id}`,
          applicationId: interview.application_id,
          interviewId: interview.id,
          companyName,
          jobTitle,
        });
      }
    }
  }

  // 2. Past round outcome needed
  // Scheduled interview round whose date has passed and outcome is still 'scheduled'
  for (const interview of interviews) {
    if (interview.outcome === "scheduled") {
      const interviewTime = new Date(interview.scheduled_at).getTime();
      if (interviewTime < nowMs) {
        const app = applications.find((a) => a.id === interview.application_id);
        const companyName = app?.company_name || "Company";
        const jobTitle = app?.job_title || "Role";
        const stageLabel = STAGE_NAMES[interview.stage_type] || interview.stage_type;

        items.push({
          id: `outcome-${interview.id}`,
          type: "outcome_needed",
          urgencyWeight: 80,
          title: `Log outcome for ${jobTitle}`,
          subtitle: `${companyName} • ${stageLabel} round took place`,
          badgeLabel: "Outcome needed",
          badgeVariant: "attention",
          actionLabel: "Log outcome →",
          actionHref: `/applications?stage=interviewing`,
          applicationId: interview.application_id,
          interviewId: interview.id,
          companyName,
          jobTitle,
        });
      }
    }
  }

  // 3. Post-interview follow-up
  // Interviewing application with past round >= 2 days ago and no follow-up generated/copied
  const followupsByAppId = new Set(followups.map((f) => f.application_id));

  for (const app of applications) {
    if (app.status === "interviewing") {
      const appInterviews = interviews.filter((i) => i.application_id === app.id);
      // Find latest completed/past round
      const pastRounds = appInterviews.filter((i) => {
        const time = new Date(i.scheduled_at).getTime();
        return time < nowMs || i.outcome === "passed" || i.outcome === "completed";
      });

      if (pastRounds.length > 0) {
        pastRounds.sort(
          (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
        );
        const latestRound = pastRounds[0];
        const daysAgo = -diffCalendarDaysMelbourne(latestRound.scheduled_at, now);

        if (daysAgo >= 2 && !followupsByAppId.has(app.id)) {
          items.push({
            id: `followup-${app.id}`,
            type: "followup_due",
            urgencyWeight: 60,
            title: `Draft follow-up for ${app.job_title}`,
            subtitle: `${app.company_name} • ${daysAgo} days since interview`,
            badgeLabel: "Follow-up due",
            badgeVariant: "accent",
            actionLabel: "Draft follow-up →",
            applicationId: app.id,
            companyName: app.company_name,
            jobTitle: app.job_title,
          });
        }
      }
    } else if (app.status === "applied" && app.applied_date) {
      // Applied >= 7 days ago with no response and no interviews scheduled
      const appInterviews = interviews.filter((i) => i.application_id === app.id);
      if (appInterviews.length === 0) {
        const daysAgo = -diffCalendarDaysMelbourne(app.applied_date, now);
        if (daysAgo >= 7 && !followupsByAppId.has(app.id)) {
          items.push({
            id: `followup-app-${app.id}`,
            type: "followup_due",
            urgencyWeight: 50,
            title: `Draft follow-up for ${app.job_title}`,
            subtitle: `${app.company_name} • Applied ${daysAgo} days ago with no response`,
            badgeLabel: "Follow-up due",
            badgeVariant: "accent",
            actionLabel: "Draft follow-up →",
            applicationId: app.id,
            companyName: app.company_name,
            jobTitle: app.job_title,
          });
        }
      }
    }
  }

  // 4. Closing soon (< 48h / <= 2 days)
  for (const ad of parsedJobAds) {
    if (ad.closes_at) {
      const daysUntil = diffCalendarDaysMelbourne(ad.closes_at, now);
      if (daysUntil >= 0 && daysUntil <= 2) {
        const companyName = ad.company_name || "Company";
        const jobTitle = ad.job_title || "Target Role";
        const isToday = daysUntil === 0;

        items.push({
          id: `closing-${ad.application_id || ad.closes_at}`,
          type: "closing_soon",
          urgencyWeight: isToday ? 100 : 70,
          title: `Review & apply — ${jobTitle} closes ${isToday ? "today" : "in 1–2 days"}`,
          subtitle: `${companyName} • Application deadline approaching`,
          badgeLabel: isToday ? "Closes today" : "Closes soon",
          badgeVariant: isToday ? "critical" : "attention",
          actionLabel: "Review & apply →",
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

export async function getAttentionItems(
  supabase: SupabaseClient,
  userId: string
): Promise<AttentionItem[]> {
  const [
    { data: applications },
    { data: interviews },
    { data: followups },
    { data: parsedJobAds },
  ] = await Promise.all([
    supabase
      .from("applications")
      .select("id, company_name, job_title, status, applied_date")
      .eq("user_id", userId),
    supabase
      .from("application_interviews")
      .select("id, application_id, stage_type, scheduled_at, outcome"),
    supabase
      .from("application_followups")
      .select("id, application_id, created_at, copied_at")
      .eq("user_id", userId),
    supabase
      .from("parsed_job_ads")
      .select("title, company, closes_at, closes_at_state")
      .not("closes_at", "is", null),
  ]);

  const mappedAds = (parsedJobAds ?? []).map((ad) => ({
    job_title: ad.title,
    company_name: ad.company,
    closes_at: ad.closes_at,
  }));

  return evaluateAttentionItems(
    applications ?? [],
    interviews ?? [],
    followups ?? [],
    mappedAds
  );
}
