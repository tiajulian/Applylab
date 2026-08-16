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
 * own words; "no number" is an equal-weight, penalty-free choice, same as achievement_metric was. */
export interface WorkExperienceWin {
  text: string;
  metric: string;
}

export interface WorkExperienceEntry {
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
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
  year: string;
  notes: string;
}

export interface RefereeEntry {
  name: string;
  title: string;
  organisation: string;
  phone: string;
  email: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  work_rights: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  work_experience: WorkExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  skills: string[];
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

export interface FactCheckFlag {
  severity: "high";
  location: string;
  message: string;
  value: string;
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
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  resumeContent: ResumeContent;
}
