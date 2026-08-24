import { CandidateProfile } from '../types/profile';

export interface FieldMatchResult {
  fieldKey: keyof CandidateProfile['personal'] | keyof CandidateProfile['preferences'] | 'workRights' | 'custom';
  valueToFill: string | boolean;
  confidence: number;
}

export const AU_REGEX_DICTIONARY = {
  firstName: /first[\s_-]?name|given[\s_-]?name|fname/i,
  lastName: /last[\s_-]?name|surname|family[\s_-]?name|lname/i,
  email: /e[\s_-]?mail/i,
  phone: /phone|mobile|contact[\s_-]?number|telephone/i,
  suburb: /suburb|city|town/i,
  state: /state|territory|region/i,
  postcode: /post[\s_-]?code|postal[\s_-]?code|zip/i,
  linkedinUrl: /linkedin/i,
  portfolioUrl: /portfolio|website|github/i,
  
  // Australian Work Rights
  citizenship: /citizen|citizenship|permanent[\s_-]?residen|working[\s_-]?rights|visa[\s_-]?status|legal[\s_-]?right[\s_-]?to[\s_-]?work|eligible[\s_-]?to[\s_-]?work/i,
  sponsorship: /require[\s_-]?sponsorship|sponsorship[\s_-]?now[\s_-]?or[\s_-]?in[\s_-]?the[\s_-]?future/i,
  
  // Notice & Salary
  noticePeriod: /notice[\s_-]?period|how[\s_-]?soon[\s_-]?can[\s_-]?you[\s_-]?start|start[\s_-]?date/i,
  salaryExpectation: /salary[\s_-]?expectation|expected[\s_-]?remuneration|target[\s_-]?package|expected[\s_-]?pay|rate/i,
  
  // Compliance
  driversLicence: /driver'?s?[\s_-]?licen[sc]e|valid[\s_-]?licen[sc]e/i,
  policeCheck: /police[\s_-]?check|criminal[\s_-]?history/i,
  workingWithChildren: /working[\s_-]?with[\s_-]?children|wwcc|blue[\s_-]?card/i
};

export function resolveWorkRightsAnswer(profile: CandidateProfile, questionContext: string): string {
  const isYesNo = /are you an australian citizen|do you have full working rights|eligible to work in australia/i.test(questionContext);
  
  if (isYesNo) {
    return profile.workRights.hasUnrestrictedWorkRights ? 'Yes' : 'No';
  }

  switch (profile.workRights.status) {
    case 'AU_CITIZEN':
      return 'Australian Citizen';
    case 'AU_PERMANENT_RESIDENT':
      return 'Permanent Resident';
    case 'NZ_CITIZEN_SCV444':
      return 'New Zealand Citizen (Special Category Visa)';
    case 'VISA_TSS_482':
      return 'Temporary Skill Shortage visa (subclass 482)';
    case 'VISA_GRADUATE_485':
      return 'Temporary Graduate visa (subclass 485)';
    case 'VISA_STUDENT_500':
      return 'Student visa (subclass 500)';
    case 'VISA_WORKING_HOLIDAY_417_462':
      return 'Working Holiday visa';
    default:
      return 'Requires Visa Sponsorship';
  }
}

export function formatAustralianPhone(rawPhone: string, format: 'international' | 'national' | 'compact' = 'national'): string {
  const cleaned = rawPhone.replace(/\D/g, '');
  
  if (cleaned.startsWith('614')) {
    const mobile = '0' + cleaned.slice(2);
    if (format === 'international') return `+61 ${mobile.slice(1, 4)} ${mobile.slice(4, 7)} ${mobile.slice(7)}`;
    if (format === 'compact') return mobile;
    return `${mobile.slice(0, 4)} ${mobile.slice(4, 7)} ${mobile.slice(7)}`;
  }
  
  if (cleaned.startsWith('04')) {
    if (format === 'international') return `+61 ${cleaned.slice(1, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
    if (format === 'compact') return cleaned;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  
  return rawPhone;
}
