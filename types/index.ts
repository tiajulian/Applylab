import type { CompactJobAd } from "@/lib/anthropic/parseJobAd";

export type Plan = "free" | "pro" | "lifetime";

export type Template = "ats-safe" | "design-forward";

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  plan: Plan;
  stripe_customer_id: string | null;
  resumes_used: number;
  onboarded: boolean;
  profile_completeness: number;
  is_admin: boolean;
  accepted_terms_at: string | null;
  accepted_terms_version: string | null;
  created_at: string;
}

/** One "win" (big or small) a candidate logs against a role: a concrete thing built, improved,
 * fixed, or delivered, with an optional metric. Never fabricated or auto-filled beyond the user's
 * own words; "no number" is an equal-weight, penalty-free choice, same as achievement_metric was.
 * `text` is always the real display string - either typed directly (legacy/manual entry) or
 * derived by lib/wins/assembleWin.ts from the structured slots below when the win was built with
 * the step-through Win Builder. The slots are optional and additive so every pre-existing
 * `{ text, metric }` win stays valid with no migration - they just have no slots to re-edit. */
export interface WorkExperienceWin {
  text: string;
  metric: string;
  /** Picked from a fixed modest-to-strong list, or freely typed via "Other". Empty when the win
   * was entered manually (pre-builder) or the step was skipped. */
  verb?: string;
  /** The concrete thing done, in the candidate's own words. */
  what?: string;
  /** Candidate's own tool picks for this win, drawn from (and added back to) UserProfile.tools. */
  tools?: string[];
  /** Candidate's own stakeholder picks for this win, drawn from (and added back to)
   * UserProfile.stakeholders. */
  stakeholders?: string[];
  /** What changed, in the candidate's own words - never a suggested or pre-filled claim. */
  outcome?: string;
}

export interface WorkExperienceEntry {
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  /** True when the candidate still holds this role. When true, end_date should be empty -
   * validated in lib/profile/validate.ts. Defaults to false for rows saved before this field
   * existed; normalizeWorkExperience.ts back-fills it from a legacy "Present"-style end_date. */
  is_current: boolean;
  description: string;
  /** Optional, user-written list of wins for this role. Never fabricated or auto-filled beyond
   * the user's own words; never required, and an empty list is a fine, unmarked state. */
  wins: WorkExperienceWin[];
}

/** Standalone project (side, freelance, volunteer, or study work), not tied to a single employer.
 * Profile-level source of truth, same confirm-once-reuse-everywhere treatment as work experience.
 * Only `title` is required; everything else is optional and never fabricated or auto-filled. */
export interface ProjectEntry {
  title: string;
  description: string;
  context: string;
  timeframe: string;
  tools: string[];
  link: string;
  outcome: string;
  /** Optional, user-written number or metric attached to `outcome`, same free-text, never-
   * suggested treatment as `metric` on WorkExperienceWin. */
  outcome_metric: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  start_date: string;
  end_date: string;
  /** True when the candidate is still studying. When true, end_date should be empty - validated
   * in lib/profile/validate.ts, same convention as WorkExperienceEntry.is_current. Defaults to
   * false for rows saved before this field existed; normalizeEducation.ts back-fills it from a
   * legacy `year` string. */
  is_current: boolean;
  notes: string;
}

export interface RefereeEntry {
  name: string;
  title: string;
  organisation: string;
  phone: string;
  email: string;
}

export type CareerGoal =
  | "career_transition"
  | "first_job"
  | "better_company"
  | "level_up_senior"
  | "break_into_tech"
  | "exploring";

export type TargetRoleCategory =
  | "tech"
  | "healthcare"
  | "finance_business"
  | "trades"
  | "retail_hospitality"
  | "other";

export type JobHuntPain =
  | "writing_resumes"
  | "not_hearing_back"
  | "interviews"
  | "knowing_what_to_apply_for";

export interface UserProfile {
  id: string;
  user_id: string;
  career_goal?: CareerGoal | null;
  target_role?: TargetRoleCategory | string | null;
  job_hunt_pain?: JobHuntPain | string | null;
  work_rights: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  work_experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  skills: string[];
  /** Candidate's own reusable tool/software picks, grown over time as the Win Builder's "Tools?"
   * step picks up new ones. Same accumulate-and-reuse pattern as `skills`. */
  tools: string[];
  /** Candidate's own reusable "who was this for" picks, grown over time as the Win Builder's
   * "For whom?" step picks up new ones. Never fabricated - only ever what the candidate typed. */
  stakeholders: string[];
  referees: RefereeEntry[];
  raw_linkedin_paste: string | null;
  updated_at: string;
}

export interface ResumeContact {
  name: string;
  phone: string;
  email: string;
  location: string;
  linkedin: string;
  work_rights: string;
}

export interface ResumeExperienceEntry {
  job_title: string;
  company: string;
  company_description: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string[];
}

export interface ResumeEducationEntry {
  degree: string;
  institution: string;
  year: string;
  notes: string;
}

export interface ResumeReferee {
  name: string;
  title: string;
  organisation: string;
  phone: string;
  email: string;
}

export interface ResumeProjectEntry {
  title: string;
  context: string;
  year: string;
  bullets: string[];
}

export interface ResumeContent {
  contact: ResumeContact;
  /** Positioning line under the name: 2-3 close variants of the target title, e.g. "Operations
   * Coordinator · Logistics Coordinator · Supply Chain Coordinator". Empty array if none apply. */
  target_titles: string[];
  summary: string;
  /** Key Skills: flat individual competency terms ("what you do"), not grouped/labelled. */
  skills: string[];
  /** Tools & Platforms: labelled category rows ("what you use"), formatted "Category: tool, tool"
   * - same shape skills used to be before the Key Skills / Tools split. */
  tools: string[];
  experience: ResumeExperienceEntry[];
  /** Optional side/freelance work. Empty array, never fabricated when the profile has none. */
  projects: ResumeProjectEntry[];
  education: ResumeEducationEntry[];
  referees: ResumeReferee[];
}

export interface ContentScoreBreakdown {
  impact: number;
  clarity: number;
  brevity: number;
  completeness: number;
}

/** Precise pointer to the exact ResumeContent element a FactCheckFlag applies to, so the preview
 * can highlight the real span rather than text-searching for `value` (which can collide with an
 * unrelated instance of a common word/number). "role" on experienceHeader/projectHeader means the
 * whole header line is suspect (e.g. the role wasn't found in the profile at all), rather than one
 * specific field within it. */
export type FactCheckTarget =
  | { kind: "summary" }
  | { kind: "skill"; index: number }
  | { kind: "tool"; index: number }
  | { kind: "education"; index: number; field: "degree" | "institution" }
  | { kind: "referee"; index: number }
  | { kind: "experienceHeader"; index: number; field: "job_title" | "company" | "dates" | "role" }
  | { kind: "experienceBullet"; index: number; bulletIndex: number }
  | { kind: "projectHeader"; index: number; field: "title" | "year" | "project" }
  | { kind: "projectBullet"; index: number; bulletIndex: number };

export interface FactCheckFlag {
  severity: "high";
  location: string;
  message: string;
  value: string;
  /** Always set by flagUnverifiedFacts, flagRetailorDrift, and flagUnconfirmedBridgeClaims - the
   * three checks the inline-highlight preview understands. Left undefined for flag-shaped items
   * synthesized from other quality-gate checks that don't map to one resume element (see
   * gateFlagsFor in ResumeWorkspace.tsx) - those stay text-only in the export review modal, with
   * no inline highlight to anchor to. */
  target?: FactCheckTarget;
  /** Set only by flagUnconfirmedBridgeClaims: the specific unconfirmed SkillsBridgeItem this flag
   * is about, so a "Confirm in Skills Bridge" fix can PATCH that exact item rather than sending
   * the user to hunt for it. */
  relatedBridgeItemId?: string;
}

/** Stable string key for a FactCheckTarget, shared by the preview's data-fc-target attributes and
 * the highlight lookup that matches flags back to rendered elements. Same key format for both
 * sides is what makes the match exact-index rather than a text search. */
export function factCheckTargetKey(target: FactCheckTarget): string {
  switch (target.kind) {
    case "summary":
      return "summary";
    case "skill":
      return `skill:${target.index}`;
    case "tool":
      return `tool:${target.index}`;
    case "education":
      return `education:${target.index}:${target.field}`;
    case "referee":
      return `referee:${target.index}`;
    case "experienceHeader":
      return `experienceHeader:${target.index}:${target.field}`;
    case "experienceBullet":
      return `experienceBullet:${target.index}:${target.bulletIndex}`;
    case "projectHeader":
      return `projectHeader:${target.index}:${target.field}`;
    case "projectBullet":
      return `projectBullet:${target.index}:${target.bulletIndex}`;
  }
}

export type GateSeverity = "hard_fail" | "warning" | "info";

/** One independent check inside the post-generation quality gate (lib/resume/qualityGate.ts).
 * `passed: false` at severity "hard_fail" is what marks a resume needs-review rather than clean;
 * "warning"/"info" surface but never block. `details` is plain, human-readable copy, never a
 * fact the gate invented - each string traces back to something the check actually found. */
export interface GateCheckResult {
  id: string;
  label: string;
  passed: boolean;
  severity: GateSeverity;
  details: string[];
}

export interface GateResult {
  /** true when any hard_fail check didn't pass - the resume must not be presented as clean. */
  needsReview: boolean;
  checks: GateCheckResult[];
}

export interface ContentScoreIssue {
  severity: "low" | "medium" | "high";
  location: string;
  message: string;
  suggestion?: string;
  /** Exact original bullet text — used to match+apply the fix; omitted for non-bullet issues. */
  bulletText?: string;
}

export interface Resume {
  id: string;
  user_id: string;
  job_description: string;
  job_title: string | null;
  company_name: string | null;
  resume_content: ResumeContent | null;
  cover_letter_content: string | null;
  ats_score: number | null;
  missing_keywords: string[];
  ats_score_content_hash: string | null;
  pdf_url: string | null;
  template: Template;
  /** User-chosen base font size (9.5-12pt, 0.5pt steps) for the on-screen preview and both
   * exports - see lib/resume/templateDensity.ts for the floor and components/resume/
   * FontSizeStepper.tsx for the control. The automatic page-fit trim ladder (lib/pdf/pageFit.ts)
   * still trims other levers, and font further down to the same floor, if this doesn't fit. */
  font_size_pt: number;
  assist_calls_used: number;
  content_score: number | null;
  content_score_breakdown: ContentScoreBreakdown | null;
  content_score_issues: ContentScoreIssue[];
  content_score_count: number;
  content_score_content_hash: string | null;
  fact_check_flags: FactCheckFlag[];
  /** Output of the bridge honesty backstop (lib/resume/factCheck.ts#flagUnconfirmedBridgeClaims),
   * stored separately from fact_check_flags above since it's a different check with a different
   * source of truth (the confirmed bridge, not the raw profile). Empty when no bridge was used. */
  bridge_fact_check_flags: FactCheckFlag[];
  /** The Skills Bridge this resume was generated from, if any. Set once at generation time. */
  skills_bridge_id: string | null;
  /** Post-generation quality gate result (lib/resume/qualityGate.ts) - deterministic checks run
   * after generation and before this row is inserted. Null for resumes generated before the
   * gate existed. */
  gate_result: GateResult | null;
  created_at: string;
}

export interface ResumeVersion {
  id: string;
  resume_id: string;
  snapshot: ResumeContent;
  label: string | null;
  created_at: string;
}

export type ApplicationStatus = "applied" | "interviewing" | "offer" | "rejected";

export type InterviewOutcome = "scheduled" | "completed" | "cancelled";

export interface ApplicationInterview {
  id: string;
  application_id: string;
  stage_type: InterviewStageType;
  scheduled_at: string;
  is_deadline: boolean;
  location: string | null;
  notes: string | null;
  outcome: InterviewOutcome;
  created_at: string;
  updated_at: string;
}

export interface ApplicationFollowup {
  id: string;
  application_id: string;
  draft_text: string;
  model: string;
  copied_at: string | null;
  edited_text: string | null;
  created_at: string;
}

export type GapSeverity = "blocking" | "important" | "polish";

export interface ProfileTask {
  id: string;
  done: boolean;
  label: string;
  severity: GapSeverity;
  weight: number;
  href: string;
  unlocks?: string;
}

export interface ProfileCompletenessResult {
  percent: number;
  tasks: ProfileTask[];
  nextTasks: ProfileTask[];
  suggestionText: string;
}

export interface Application {
  id: string;
  user_id: string;
  resume_id: string | null;
  company_name: string;
  job_title: string;
  status: ApplicationStatus;
  applied_date: string;
  job_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ATSScoreResult {
  score: number;
  missing_keywords: string[];
  matched_keywords: string[];
  feedback: string;
}

export type BridgeMode = "pivot" | "level_up";
export type BridgeItemState = "matched" | "to_confirm" | "gap";
export type BridgeItemUserState = "pending" | "confirmed" | "rejected";
export type BridgeConfidence = "low" | "medium" | "high";

export interface SkillsBridge {
  id: string;
  user_id: string;
  job_title: string;
  company_name: string;
  job_description_hash: string;
  mode: BridgeMode;
  created_at: string;
}

export interface SkillsBridgeItem {
  id: string;
  bridge_id: string;
  /** Empty for `gap` items — there is no real source to point to. */
  source_company: string;
  source_job_title: string;
  source_snippet: string;
  competency: string;
  target_requirement: string;
  state: BridgeItemState;
  confidence: BridgeConfidence;
  user_state: BridgeItemUserState;
  /** User's own phrasing affirming a `to_confirm` item, or a correction on a `matched` one. */
  user_note: string | null;
}

/** The subset of a bridge actually allowed to influence generation: confirmed items only. */
export interface ConfirmedBridgeItem {
  source_company: string;
  source_job_title: string;
  competency: string;
  target_requirement: string;
  user_note: string | null;
}

export interface ConfirmedBridge {
  mode: BridgeMode;
  items: ConfirmedBridgeItem[];
}

export interface GenerateResumeInput {
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  /** Drives the optional, off-by-default free-tier-on-Haiku model selection — see
   * lib/anthropic/models.ts#resolveResumeModel. Has no effect while that flag is disabled. */
  plan: Plan;
  profile: Pick<
    UserProfile,
    | "career_goal"
    | "target_role"
    | "job_hunt_pain"
    | "work_rights"
    | "phone"
    | "location"
    | "linkedin_url"
    | "work_experience"
    | "projects"
    | "education"
    | "skills"
    | "referees"
    | "raw_linkedin_paste"
  >;
  fullName: string;
  email: string;
  confirmedBridge?: ConfirmedBridge;
  confirmedRoleDuties?: ConfirmedRoleDuty[];
}

export type RoleDutyItemUserState = "pending" | "confirmed" | "rejected";

export interface RoleDutySuggestion {
  id: string;
  user_id: string;
  job_title: string;
  created_at: string;
}

export interface RoleDutyItem {
  id: string;
  suggestion_id: string;
  duty_text: string;
  user_edited_text: string | null;
  user_state: RoleDutyItemUserState;
  /** Optional, user-written: what this duty achieved or why it mattered. The only source of a
   * task's impact - never inferred or generated. Only meaningful once the duty is confirmed. */
  outcome_text: string | null;
  /** Optional, user-written number or metric attached to `outcome_text`, same free-text, never-
   * suggested treatment as WorkExperienceWin.metric/outcome_metric elsewhere in the profile. */
  outcome_metric: string | null;
  /** Optional, user's own tool/stakeholder picks for this duty, same slots as WorkExperienceWin
   * and drawn from (and added back to) UserProfile.tools/stakeholders. Filled via the Win Builder
   * when the duty is thin - see lib/wins/dutyCoverage.ts and RoleDutiesReview.tsx. Not yet fed
   * into generation (ConfirmedRoleDuty below doesn't carry them). */
  tools: string[];
  stakeholders: string[];
  /** Short (1-3 word) grouping label assigned by suggestRoleDuties (e.g. "Data engineering"),
   * used to drive the category filter tabs in SuggestTasksBuilder.tsx. Null for rows generated
   * before this column existed. */
  category: string | null;
}

/** The subset of suggested duties actually allowed to influence generation: confirmed only. */
export interface ConfirmedRoleDuty {
  job_title: string;
  duty_text: string;
  outcome_text?: string;
  outcome_metric?: string;
}

export interface ParsedProfileFields {
  fullName: string;
  phone: string;
  location: string;
  linkedin_url: string;
  work_rights: string;
  skills: string[];
  work_experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  referees: RefereeEntry[];
}

export interface GenerateCoverLetterInput {
  compactJobAd: CompactJobAd;
  jobTitle: string;
  companyName: string;
  resumeContent: ResumeContent;
}

// ============================================================================================
// AI Interview Prep Types
// ============================================================================================

export type InterviewStageType =
  | "phone_screen"
  | "technical"
  | "panel"
  | "async_video"
  | "group"
  | "general";

export type InterviewSessionStatus = "in_progress" | "completed" | "abandoned";

/**
 * 'coaching' is 'group' only - a 1:1 voice AI can't honestly assess multi-party group dynamics,
 * so that stage skips STAR scoring entirely rather than fabricating a score for something it
 * can't observe. Every other stage is 'simulation' (normal scored Q&A). See lib/interview/mode.ts.
 */
export type InterviewMode = "simulation" | "coaching";

export type InterviewAnswerSource = "voice" | "text";

export interface StarScores {
  situation: number;
  task: number;
  action: number;
  result: number;
  summary: string;
}

export interface InterviewTurn {
  id: string;
  session_id: string;
  order_index: number;
  question_type: string;
  question_text: string;
  is_followup: boolean;
  parent_turn_id: string | null;
  transcript: string | null;
  answer_source: InterviewAnswerSource | null;
  duration_sec: number | null;
  wpm: number | null;
  filler_count: number | null;
  star_scores: StarScores | null;
  content_feedback: string | null;
  delivery_feedback: string | null;
  suggested_answer: string | null;
  created_at: string;
}

export interface InterviewReportQuestionSummary {
  order_index: number;
  question_text: string;
  question_type: string;
  star_scores: StarScores | null;
  wpm: number | null;
  duration_sec: number | null;
  filler_count: number | null;
  key_takeaway: string;
}

export interface InterviewReport {
  mode: InterviewMode;
  // null for a 'coaching' session (e.g. 'group' stage) - there is no STAR rubric to score
  // against, so these are never fabricated. See lib/gemini/generateInterviewReport.ts.
  overall_score: number | null;
  star_averages: {
    situation: number;
    task: number;
    action: number;
    result: number;
  } | null;
  strengths: string[];
  areas_for_improvement: string[];
  delivery_summary: {
    avg_wpm: number;
    pacing_rating: "too_slow" | "good" | "too_fast";
    pacing_feedback: string;
    filler_feedback: string;
  };
  honest_gap_review?: string;
  question_summaries: InterviewReportQuestionSummary[];
}

export interface InterviewSession {
  id: string;
  user_id: string;
  resume_id: string;
  stage_type: InterviewStageType;
  mode: InterviewMode;
  status: InterviewSessionStatus;
  overall_score: number | null;
  report: InterviewReport | null;
  created_at: string;
  completed_at: string | null;
}

export interface CreateInterviewSessionInput {
  resume_id: string;
  stage_type: InterviewStageType;
}

export interface ScoreAnswerInput {
  turn_id: string;
  audio_base64?: string;
  mime_type?: string;
  duration_sec?: number;
  text_answer?: string;
}

export interface TurnScoreResult {
  turn: InterviewTurn;
  next_question?: {
    id: string;
    order_index: number;
    question_type: string;
    question_text: string;
    is_followup: boolean;
  };
  report?: InterviewReport;
  done: boolean;
}

