export interface CreateApplicationPayload {
  jobTitle: string;
  companyName: string;
  location?: string;
  jobUrl: string;
  platform: 'SEEK' | 'LinkedIn' | 'Workday' | 'PageUp' | 'LiveHire' | 'Other';
  status?: 'applied' | 'interviewing' | 'offer' | 'rejected';
  notes?: string;
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
