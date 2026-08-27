import type { SupabaseClient } from "@supabase/supabase-js";
import { diffCalendarDaysMelbourne } from "@/lib/dateUtils";
import type { ApplicationInterview, InterviewOutcome } from "@/types";

export type AttentionItemType = "closing_soon" | "followup_due" | "outcome_needed";

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

  // 1. Rule 3: Past round outcome needed
  // Scheduled interview round whose date has passed and outcome is still 'scheduled'
  for (const interview of interviews) {
    if (interview.outcome === "scheduled") {
      const interviewTime = new Date(interview.scheduled_at).getTime();
      if (interviewTime < nowMs) {
        const app = applications.find((a) => a.id === interview.application_id);
        const companyName = app?.company_name || "Company";
        const jobTitle = app?.job_title || "Role";
        const stageName = interview.stage_type.replace(/_/g, " ");

        items.push({
          id: `outcome-${interview.id}`,
          type: "outcome_needed",
          urgencyWeight: 80,
          title: `Log outcome for ${jobTitle}`,
          subtitle: `${companyName} • ${stageName} round took place`,
          badgeLabel: "Outcome needed",
          badgeVariant: "attention",
          actionLabel: "How did it go? →",
          actionHref: `/applications?stage=interviewing`,
          applicationId: interview.application_id,
          interviewId: interview.id,
          companyName,
          jobTitle,
        });
      }
    }
  }

  // 2. Rule 2: Post-interview follow-up
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
        const daysAgo = -diffCalendarDaysMelbourne(latestRound.scheduled_at);

        if (daysAgo >= 2 && !followupsByAppId.has(app.id)) {
          items.push({
            id: `followup-${app.id}`,
            type: "followup_due",
            urgencyWeight: 60,
            title: `Follow up on ${app.job_title}`,
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
    }
  }

  // 3. Rule 1: Closing soon (< 48h / <= 2 days)
  for (const ad of parsedJobAds) {
    if (ad.closes_at) {
      const daysUntil = diffCalendarDaysMelbourne(ad.closes_at);
      if (daysUntil >= 0 && daysUntil <= 2) {
        const companyName = ad.company_name || "Company";
        const jobTitle = ad.job_title || "Target Role";
        const isToday = daysUntil === 0;

        items.push({
          id: `closing-${ad.application_id || ad.closes_at}`,
          type: "closing_soon",
          urgencyWeight: isToday ? 100 : 70,
          title: `${jobTitle} closes ${isToday ? "today" : "in 1–2 days"}`,
          subtitle: `${companyName} • Application deadline approaching`,
          badgeLabel: isToday ? "Closes today" : "Closes soon",
          badgeVariant: isToday ? "critical" : "attention",
          actionLabel: "Finish application →",
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
