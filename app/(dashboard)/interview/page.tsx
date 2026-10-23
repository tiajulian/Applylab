import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { InterviewSetup } from "@/components/interview/InterviewSetup";
import { fetchRoleDutiesContext } from "@/lib/resume/fetchConfirmedRoleDuties";
import { practiceSummaries, progressPoints, toHistoryItem, type HistorySessionRow, type ProgressSessionRow } from "@/lib/interview/history";
import type { Resume, Application, ApplicationInterview, InterviewTurn, StarPart, UploadedResumeSummary, WorkExperienceEntry } from "@/types";

export const metadata = { title: "Interview practice" };

export const dynamic = "force-dynamic";

/** "Your practice" groups each page by job on the client, so a page is large enough to hold a
 *  job's whole recent run. */
const HISTORY_PAGE_SIZE = 100;

type RoundSessionRow = {
  id: string;
  created_at: string;
  overall_score: number | null;
  application_interview_id: string | null;
  star_averages: Partial<Record<StarPart, number>> | null;
};
/** Progress uses the latest scored sessions; enough for a trend without loading everything. */
const PROGRESS_SESSIONS = 20;

export default async function InterviewPage(props: {
  searchParams: Promise<{ application?: string; stage?: string; interview?: string; page?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);
  const from = (page - 1) * HISTORY_PAGE_SIZE;

  const supabase = createClient();
  const [
    { data: resumes },
    { data: applications },
    { data: interviews },
    { data: profile },
    { data: historyRows, count: historyTotal },
    { data: scoredSessions },
    { data: roundSessions },
    { data: uploadedResumes },
  ] = await Promise.all([
    supabase
      .from("resumes")
      // InterviewSetup only reads id/job_title/company_name/resume_content (for its readiness
      // score) - dropping cover_letter_content, job_description, pdf_url etc. cuts real payload
      // since this page loads every one of the user's resumes up front for client-side switching.
      .select("id, job_title, company_name, resume_content")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("applications")
      .select("*")
      .eq("user_id", user.authUserId),
    supabase
      .from("application_interviews")
      .select("*, applications!inner(user_id)")
      .eq("applications.user_id", user.authUserId),
    // The skills and roles the question writer is actually sent (lib/interview/questionContext.ts),
    // for "Questions use N duties and M skills from your profile".
    supabase.from("user_profiles").select("skills, tools, work_experience").eq("user_id", user.authUserId).maybeSingle(),
    supabase
      .from("interview_sessions")
      .select(
        "id, created_at, stage_type, status, ended_reason, overall_score, mode, resume_id, uploaded_resume_id, job_title, company_name, application_id, application_interview_id, resumes(job_title, company_name)",
        { count: "exact" }
      )
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false })
      .range(from, from + HISTORY_PAGE_SIZE - 1),
    supabase
      .from("interview_sessions")
      .select("id, created_at, resume_id, uploaded_resume_id, job_title, company_name, mode")
      .eq("user_id", user.authUserId)
      .eq("report_status", "ready")
      .eq("mode", "simulation")
      .order("created_at", { ascending: false })
      .limit(PROGRESS_SESSIONS),
    supabase
      .from("interview_sessions")
      .select("id, created_at, overall_score, application_interview_id, star_averages:report->star_averages")
      .eq("user_id", user.authUserId)
      .eq("status", "completed")
      .not("application_interview_id", "is", null),
    // Saved "Upload my resume" resumes; their text stays on the server.
    supabase
      .from("uploaded_resumes")
      .select("id, name, source, created_at")
      .eq("user_id", user.authUserId)
      .order("created_at", { ascending: false }),
  ]);

  // First tries only (turn rows), never retries, for honest progress.
  const sessionIds = (scoredSessions ?? []).map((s) => s.id);
  const [{ data: scoredTurns }, confirmedDuties] = await Promise.all([
    sessionIds.length
      ? supabase
          .from("interview_turns")
          .select("session_id, rubric, question_type, star_scores, rubric_scores, score_reasons")
          .in("session_id", sessionIds)
          .eq("skipped", false)
          .not("transcript", "is", null)
      : Promise.resolve({ data: [] }),
    fetchRoleDutiesContext(supabase, user.authUserId, (profile?.work_experience ?? []) as WorkExperienceEntry[]),
  ]);
  const profileSkillCount = (profile?.skills?.length ?? 0) + (profile?.tools?.length ?? 0);

  const progress = progressPoints(
    (scoredSessions ?? []) as ProgressSessionRow[],
    (scoredTurns ?? []) as Pick<InterviewTurn, "session_id" | "rubric" | "question_type" | "star_scores" | "rubric_scores" | "score_reasons">[]
  );
  const roundPractice = Object.fromEntries(
    practiceSummaries(
      (roundSessions ?? []) as unknown as RoundSessionRow[],
      (r) => r.application_interview_id
    )
  );

  return (
    <div className="w-full">
      <InterviewSetup
        resumes={(resumes || []) as Resume[]}
        uploadedResumes={(uploadedResumes || []) as UploadedResumeSummary[]}
        applications={(applications || []) as Application[]}
        interviews={(interviews || []) as ApplicationInterview[]}
        user={user.appUser!}
        initialApplicationId={searchParams.application}
        initialStage={searchParams.stage}
        initialInterviewId={searchParams.interview}
        profileSkillCount={profileSkillCount}
        profileDutyCount={confirmedDuties.length}
        history={((historyRows ?? []) as unknown as HistorySessionRow[]).map(toHistoryItem)}
        historyPage={page}
        historyPageCount={Math.max(1, Math.ceil((historyTotal ?? 0) / HISTORY_PAGE_SIZE))}
        progress={progress}
        roundPractice={roundPractice}
      />
    </div>
  );
}
