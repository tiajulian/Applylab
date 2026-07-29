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
  created_at: string;
}

export interface WorkExperienceEntry {
  job_title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  description: string;
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

export interface ResumeContent {
  contact: ResumeContact;
  summary: string;
  skills: string[];
  experience: ResumeExperienceEntry[];
  education: ResumeEducationEntry[];
  referees: ResumeReferee[];
}

export interface ContentScoreBreakdown {
  impact: number;
  clarity: number;
  brevity: number;
  completeness: number;
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
  pdf_url: string | null;
  template: Template;
  assist_calls_used: number;
  content_score: number | null;
  content_score_breakdown: ContentScoreBreakdown | null;
  content_score_issues: ContentScoreIssue[];
  content_score_count: number;
  created_at: string;
}

export interface ATSScoreResult {
  score: number;
  missing_keywords: string[];
  matched_keywords: string[];
  feedback: string;
}

export interface GenerateResumeInput {
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  profile: Pick<
    UserProfile,
    | "work_rights"
    | "phone"
    | "location"
    | "linkedin_url"
    | "work_experience"
    | "education"
    | "skills"
    | "referees"
    | "raw_linkedin_paste"
  >;
  fullName: string;
  email: string;
}

export interface ParsedProfileFields {
  fullName: string;
  phone: string;
  location: string;
  linkedin_url: string;
  work_rights: string;
  skills: string[];
  work_experience: WorkExperienceEntry[];
  education: EducationEntry[];
  referees: RefereeEntry[];
}

export interface GenerateCoverLetterInput {
  jobDescription: string;
  jobTitle: string;
  companyName: string;
  resumeContent: ResumeContent;
}
