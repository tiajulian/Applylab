import { getOrParseCompactJobAd } from "@/lib/resume/parsedJobAdCache";
import { fetchRoleDutiesContext } from "@/lib/resume/fetchConfirmedRoleDuties";
import { rubricForQuestionType } from "@/lib/interview/rubrics";
import { targetJobTitle } from "@/lib/resume/generalResume";
import type { GenerateQuestionsInput, GapBridgeItem } from "@/lib/gemini/generateInterviewQuestions";
import type { createClient } from "@/lib/supabase/server";
import type { ConfirmedBridgeItem, Plan, Resume, StoryHint, UserProfile } from "@/types";

type SupabaseServerClient = ReturnType<typeof createClient>;

export type QuestionContext = Pick<
  GenerateQuestionsInput,
  | "jobTitle"
  | "companyName"
  | "jobDescription"
  | "compactJobAd"
  | "profile"
  | "confirmedBridgeItems"
  | "gapBridgeItems"
  | "confirmedRoleDuties"
>;

/** Everything the question writer is grounded in for one resume: the job ad, the profile, the
 *  confirmed skills bridge and confirmed role duties. Shared by session creation and "Try
 *  tailoring again"; the setup page's "Questions use N duties and M skills" counts the same. */
export function loadQuestionContext(
  supabase: SupabaseServerClient,
  authUserId: string,
  plan: Plan,
  resume: Resume
): Promise<QuestionContext> {
  return loadProfileQuestionContext(
    supabase,
    authUserId,
    plan,
    { jobTitle: targetJobTitle(resume.job_title), companyName: resume.company_name, jobDescription: resume.job_description || "" },
    resume.skills_bridge_id
  );
}

/** The Career Profile grounding for a job: a tailored resume's (with its skills bridge), or a
 *  pasted job ad's for "Just the job ad" practice (no bridge). */
export async function loadProfileQuestionContext(
  supabase: SupabaseServerClient,
  authUserId: string,
  plan: Plan,
  job: { jobTitle: string | null; companyName: string | null; jobDescription: string },
  skillsBridgeId: string | null = null
): Promise<QuestionContext> {
  const [{ data: profileRow }, compactJobAd, { data: bridgeItems }] = await Promise.all([
    supabase.from("user_profiles").select("*").eq("user_id", authUserId).maybeSingle(),
    getOrParseCompactJobAd(job.jobDescription, authUserId, supabase, plan),
    skillsBridgeId
      ? supabase.from("skills_bridge_items").select("*").eq("bridge_id", skillsBridgeId)
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

  const profile = (profileRow || {}) as Partial<UserProfile>;
  const confirmedRoleDuties = await fetchRoleDutiesContext(supabase, authUserId, profile.work_experience ?? []);

  return {
    jobTitle: job.jobTitle || "Target Role",
    companyName: job.companyName || "Target Company",
    jobDescription: job.jobDescription,
    compactJobAd,
    profile,
    confirmedBridgeItems,
    gapBridgeItems,
    confirmedRoleDuties,
  };
}

/** The question writer's grounding for "Upload my resume" practice: only that resume and the
 *  pasted job ad. The Career Profile, skills bridge and role duties are left out, so story hints
 *  can only point at what's actually in the uploaded resume. */
export async function loadUploadedQuestionContext(
  supabase: SupabaseServerClient,
  authUserId: string,
  plan: Plan,
  parsed: Partial<UserProfile>,
  job: { jobTitle: string | null; companyName: string | null; jobDescription: string }
): Promise<QuestionContext> {
  return {
    jobTitle: job.jobTitle || "Target Role",
    companyName: job.companyName || "Target Company",
    jobDescription: job.jobDescription,
    compactJobAd: await getOrParseCompactJobAd(job.jobDescription, authUserId, supabase, plan),
    profile: parsed,
    confirmedBridgeItems: [],
    gapBridgeItems: [],
    confirmedRoleDuties: [],
  };
}

/** Rows for interview_turns from planned questions; the panel interviewer is kept as a prefix. */
export function plannedTurnRows(
  sessionId: string,
  questions: Array<{
    question_type: string;
    question_text: string;
    interviewer_persona?: string;
    suggested_evidence?: StoryHint[] | null;
  }>
) {
  return questions.map((q, idx) => ({
    session_id: sessionId,
    order_index: idx + 1,
    question_type: q.question_type,
    question_text: q.interviewer_persona ? `[${q.interviewer_persona}] ${q.question_text}` : q.question_text,
    is_followup: false,
    rubric: rubricForQuestionType(q.question_type),
    suggested_evidence: q.suggested_evidence?.length ? q.suggested_evidence : null,
  }));
}
