export interface CreateApplicationPayload {
  jobTitle: string;
  companyName: string;
  location?: string;
  jobUrl: string;
  platform: 'SEEK' | 'LinkedIn' | 'Workday' | 'PageUp' | 'LiveHire' | 'Other';
  status?: 'applied' | 'interviewing' | 'offer' | 'rejected';
  /** The browser tab title, so the server never saves it as the job title by mistake. */
  pageTitle?: string;
  /** The user checked the title and company in the confirm prompt. */
  confirmed?: boolean;
}

/** The server couldn't find a real job title or company: ask the user, starting from these. */
export interface NeedsDetails {
  needsDetails: true;
  suggested: { jobTitle: string; companyName: string };
}

export interface ApplicationRecord {
  id: string;
  user_id: string;
  company_name: string;
  job_title: string;
  status: string;
  applied_date: string;
  job_url?: string;
  notes?: string;
}
