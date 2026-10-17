import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { targetJobTitle } from "@/lib/resume/generalResume";
import type { GenerateQuestionsInput, GapBridgeItem } from "@/lib/gemini/generateInterviewQuestions";
import type { createClient } from "@/lib/supabase/server";
import type { ConfirmedBridgeItem, Plan, Resume, UserProfile } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

export type QuestionContext = Pick<
  GenerateQuestionsInput,
  "jobTitle" | "companyName" | "jobDescription" | "compactJobAd" | "profile" | "confirmedBridgeItems" | "gapBridgeItems"
>;

/** Everything the question writer is grounded in for one resume: the job ad, the profile and the
 *  confirmed skills bridge. Shared by session creation and "Try tailoring again". */
export async function loadQuestionContext(
  supabase: SupabaseServerClient,
  authUserId: string,
  plan: Plan,
  resume: Resume
): Promise<QuestionContext> {
  const [{ data: profileRow }, compactJobAd, { data: bridgeItems }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", authUserId).maybeSingle(),
    getOrParseCompactJobAd(resume.job_description || "", authUserId, supabase, plan),
    resume.skills_bridge_id
      ? supabase.from("skills_bridge_items").select("*").eq("bridge_id", resume.skills_bridge_id)
      : Promise.resolve({ data: null }),
  ]);

  const items = (bridgeItems || []) as Array<Record<string, any>>;
  const confirmedBridgeItems: ConfirmedBridgeItem[] = items
    .filter((i) => (i.state === "matched" || i.state === "to_confirm") && i.user_state === "confirmed")
    .map((i) => ({
      source_company: i.source_company,
      source_job_title: i.source_job_title,
      competency: i.competency,
      target_requirement: i.target_requirement,
      user_note: i.user_note,
    }));
  const gapBridgeItems: GapBridgeItem[] = items
    .filter((i) => i.state === "gap")
    .map((i) => ({ competency: i.competency, target_requirement: i.target_requirement }));

  return {
    jobTitle: targetJobTitle(resume.job_title) || "Target Role",
    companyName: resume.company_name || "Target Company",
    jobDescription: resume.job_description || "",
    compactJobAd,
    profile: (profileRow || {}) as Partial<UserProfile>,
    confirmedBridgeItems,
    gapBridgeItems,
  };
}

/** Rows for interview_turns from planned questions; the panel interviewer is kept as a prefix. */
export function plannedTurnRows(
  sessionId: string,
  questions: Array<{ question_type: string; question_text: string; interviewer_persona?: string }>
) {
  return questions.map((q, idx) => ({
    session_id: sessionId,
    order_index: idx + 1,
    question_type: q.question_type,
    question_text: q.interviewer_persona ? `[${q.interviewer_persona}] ${q.question_text}` : q.question_text,
    is_followup: false,
  }));
}
