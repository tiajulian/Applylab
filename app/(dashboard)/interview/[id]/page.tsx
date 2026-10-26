import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { InterviewWorkspace } from "@/components/interview/InterviewWorkspace";
import { practiceJobKey } from "@/lib/interview/uploadedResume";
import type { InterviewSession, InterviewTurn, InterviewTurnAttempt } from "@/types";

export const metadata = { title: "Interview practice" };

export const dynamic = "force-dynamic";

/** Earlier sessions from the same resume searched for one at the same job. */
const PREVIOUS_LOOKBACK = 20;

export default async function InterviewSessionPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = createClient();

  // turns/attempts only depend on params.id, not on the session row, so these don't need to be
  // serialized - fetch them all up front instead of waiting on session first.
  const [
    { data: session, error: sessionError },
    { data: turns, error: turnsError },
    { data: attempts },
  ] = await Promise.all([
    supabase
      .from("interview_sessions")
      .select("*, resumes(id, job_title, company_name, job_description)")
      .eq("id", params.id)
      .eq("user_id", user.authUserId)
      .single(),
    supabase
      .from("interview_turns")
      .select("*")
      .eq("session_id", params.id)
      .order("order_index", { ascending: true }),
    supabase.from("interview_turn_attempts").select("*").eq("session_id", params.id),
  ]);

  if (sessionError || !session) {
    redirect("/interview");
  }

  if (turnsError) {
    redirect("/interview");
  }

  // Free accounts can open their own free practice, nothing else (e.g. a session left over from
  // a lapsed Pro subscription). The API routes enforce the same rule.
  const isFree = user.appUser?.plan === "free";
  if (isFree && !session.is_free_allowance) {
    redirect("/upgrade");
  }

  // The last scored practice for the same job (practiceJobKey, as on the progress chart), for
  // "Up 0.5 from your last practice for this job". An uploaded resume that was deleted has none.
  const sameSource: { column: string; value: string | boolean } | null = session.resume_id
    ? { column: "resume_id", value: session.resume_id }
    : session.uploaded_resume_id
      ? { column: "uploaded_resume_id", value: session.uploaded_resume_id }
      : session.job_ad_only
        ? { column: "job_ad_only", value: true }
        : null;
  const { data: earlier } = sameSource
    ? await supabase
        .from("interview_sessions")
        .select("overall_score, resume_id, uploaded_resume_id, job_title, company_name")
        .eq("user_id", user.authUserId)
        .eq(sameSource.column, sameSource.value)
        .eq("report_status", "ready")
        .neq("id", session.id)
        .lt("created_at", session.created_at)
        .not("overall_score", "is", null)
        .order("created_at", { ascending: false })
        .limit(PREVIOUS_LOOKBACK)
    : { data: null };
  const jobKey = practiceJobKey(session);
  const previous = (earlier ?? []).find((s) => practiceJobKey(s) === jobKey);

  return (
    // Wide enough for the answering view's side column; every other view narrows itself.
    <div className="mx-auto max-w-5xl">
      <InterviewWorkspace
        key={session.id}
        initialSession={session as InterviewSession}
        initialTurns={(turns || []) as InterviewTurn[]}
        initialAttempts={(attempts || []) as InterviewTurnAttempt[]}
        previousOverallScore={previous?.overall_score ?? null}
        isFree={isFree}
        initialMicConsented={Boolean(user.appUser?.mic_consent_at)}
      />
    </div>
  );
}
