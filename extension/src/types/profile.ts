export interface AustralianWorkRights {
  status: 
    | 'AU_CITIZEN' 
    | 'AU_PERMANENT_RESIDENT' 
    | 'NZ_CITIZEN_SCV444' 
    | 'VISA_TSS_482' 
    | 'VISA_GRADUATE_485' 
    | 'VISA_STUDENT_500' 
    | 'VISA_WORKING_HOLIDAY_417_462' 
    | 'NEEDS_SPONSORSHIP';
  hasUnrestrictedWorkRights: boolean;
  requiresSponsorshipNowOrFuture: boolean;
  visaExpiryDate?: string; // YYYY-MM-DD
}

export interface CandidateProfile {
  personal: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string; // e.g. "0412345678"
    streetAddress: string;
    suburb: string;
    state: 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT';
    postcode: string;
    country: 'Australia';
    linkedinUrl: string;
    portfolioUrl?: string;
    githubUrl?: string;
  };
  workRights: AustralianWorkRights;
  preferences: {
    noticePeriodWeeks: number; // e.g. 4
    noticePeriodDescription: 'Immediately' | '2 Weeks' | '4 Weeks' | 'Negotiable';
    expectedSalaryAnnualAUD: number; // e.g. 135000
    expectedRateDailyAUD?: number;
    hasAustralianDriversLicence: boolean;
    driversLicenceClass?: 'C' | 'C-A' | 'None';
    hasWorkingWithChildrenCheck: boolean;
    wwccNumber?: string;
    willingToUndergoPoliceCheck: boolean;
  };
  experienceSummary: {
    currentJobTitle: string;
    currentCompany: string;
    yearsOfExperience: number;
    skills: string[];
    topAchievements: string[];
  };
  activeResumeId: string;
  activeResumeName: string;
}
