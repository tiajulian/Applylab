import type { SupabaseClient } from "@supabase/supabase-js";
import type { InterviewStageType } from "@/types";

export interface NextInterviewSummary {
  scheduledAt: string;
  stageType: InterviewStageType;
  applicationId: string;
  companyName: string;
  jobTitle: string;
}

export interface PipelineCounts {
  drafted: number; // resumes with no linked application
  applied: number; // status 'applied'
  screening: number; // status 'interviewing' and (no scheduled round OR soonest is 'phone_screen')
  interview: number; // status 'interviewing' and soonest round is non-phone
  offer: number; // status 'offer'
  total: number; // sum of the five
  nextInterview: NextInterviewSummary | null;
}

export function computePipelineCountsFromData(
  resumes: Array<{ id: string }>,
  applications: Array<{
    id: string;
    resume_id: string | null;
    status: string;
    company_name: string;
    job_title: string;
  }>,
  interviews: Array<{
    id: string;
    application_id: string;
    stage_type: InterviewStageType;
    scheduled_at: string;
    outcome: string;
  }>
): PipelineCounts {
  // 1. Drafted: Resumes not attached to any active application
  const linkedResumeIds = new Set(
    applications
      .map((app) => app.resume_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  );
  const drafted = resumes.filter((r) => !linkedResumeIds.has(r.id)).length;

  // 2. Applied
  const applied = applications.filter((app) => app.status === "applied").length;

  // 3. Offer
  const offer = applications.filter((app) => app.status === "offer").length;

  // Group scheduled interviews by application
  const scheduledInterviewsByApp = new Map<
    string,
    Array<{ stage_type: InterviewStageType; scheduled_at: string }>
  >();

  const nowMs = Date.now();
  const upcomingScheduledRounds: Array<{
    scheduledAt: string;
    stageType: InterviewStageType;
    applicationId: string;
    time: number;
  }> = [];

  for (const interview of interviews) {
    if (interview.outcome === "scheduled") {
      const list = scheduledInterviewsByApp.get(interview.application_id) ?? [];
      list.push(interview);
      scheduledInterviewsByApp.set(interview.application_id, list);

      const time = new Date(interview.scheduled_at).getTime();
      if (time >= nowMs - 60 * 60 * 1000) {
        // within or ahead of current hour
        upcomingScheduledRounds.push({
          scheduledAt: interview.scheduled_at,
          stageType: interview.stage_type,
          applicationId: interview.application_id,
          time,
        });
      }
    }
  }

  // 4. Screening vs Interview
  let screening = 0;
  let interview = 0;

  const interviewingApps = applications.filter((app) => app.status === "interviewing");
  for (const app of interviewingApps) {
    const rounds = scheduledInterviewsByApp.get(app.id) ?? [];
    // Sort rounds ascending by date
    rounds.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
    const soonest = rounds[0];

    if (!soonest || soonest.stage_type === "phone_screen") {
      screening++;
    } else {
      interview++;
    }
  }

  // Next upcoming interview
  upcomingScheduledRounds.sort((a, b) => a.time - b.time);
  let nextInterview: NextInterviewSummary | null = null;
  if (upcomingScheduledRounds.length > 0) {
    const first = upcomingScheduledRounds[0];
    const app = applications.find((a) => a.id === first.applicationId);
    if (app) {
      nextInterview = {
        scheduledAt: first.scheduledAt,
        stageType: first.stageType,
        applicationId: first.applicationId,
        companyName: app.company_name,
        jobTitle: app.job_title,
      };
    }
  }

  const total = drafted + applied + screening + interview + offer;

  return {
    drafted,
    applied,
    screening,
    interview,
    offer,
    total,
    nextInterview,
  };
}

/**
 * Loads pipeline counts in a single server-side batch.
 */
export async function getPipelineCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<PipelineCounts> {
  const [{ data: resumes }, { data: applications }, { data: interviews }] = await Promise.all([
    supabase.from("resumes").select("id").eq("user_id", userId),
    supabase
      .from("applications")
      .select("id, resume_id, status, company_name, job_title")
      .eq("user_id", userId),
    supabase
      .from("application_interviews")
      .select("id, application_id, stage_type, scheduled_at, outcome")
      .order("scheduled_at", { ascending: true }),
  ]);

  return computePipelineCountsFromData(
    resumes ?? [],
    applications ?? [],
    interviews ?? []
  );
}
