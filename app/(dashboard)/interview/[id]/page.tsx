import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { createClient } from "@/lib/supabase/server";
import { InterviewWorkspace } from "@/components/interview/InterviewWorkspace";
import type { InterviewSession, InterviewTurn } from "@/types";

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

  const { data: session, error: sessionError } = await supabase
    .from("interview_sessions")
    .select("*, resumes(id, job_title, company_name, job_description)")
    .eq("id", params.id)
    .eq("user_id", user.authUserId)
    .single();

  if (sessionError || !session) {
    redirect("/interview");
  }

  const { data: turns, error: turnsError } = await supabase
    .from("interview_turns")
    .select("*")
    .eq("session_id", params.id)
    .order("order_index", { ascending: true });

  if (turnsError) {
    redirect("/interview");
  }

  return (
    <div className="mx-auto max-w-4xl">
      <InterviewWorkspace
        initialSession={session as InterviewSession}
        initialTurns={(turns || []) as InterviewTurn[]}
      />
    </div>
  );
}
