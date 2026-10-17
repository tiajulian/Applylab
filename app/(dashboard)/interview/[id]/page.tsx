import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { InterviewWorkspace } from "@/components/interview/InterviewWorkspace";
import type { InterviewSession, InterviewTurn, InterviewTurnAttempt } from "@/types";

export const dynamic = "force-dynamic";

export default async function InterviewSessionPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.appUser?.plan === "free") {
    redirect("/upgrade");
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

  // The last scored practice for the same job, for "Up 0.5 from your last practice for this job".
  const { data: previous } = await supabase
    .from("interview_sessions")
    .select("overall_score")
    .eq("user_id", user.authUserId)
    .eq("resume_id", session.resume_id)
    .eq("report_status", "ready")
    .neq("id", session.id)
    .lt("created_at", session.created_at)
    .not("overall_score", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-3xl">
      <InterviewWorkspace
        key={session.id}
        initialSession={session as InterviewSession}
        initialTurns={(turns || []) as InterviewTurn[]}
        initialAttempts={(attempts || []) as InterviewTurnAttempt[]}
        previousOverallScore={previous?.overall_score ?? null}
      />
    </div>
  );
}
