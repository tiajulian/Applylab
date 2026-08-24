import { CandidateProfile } from '../../types/profile';

export interface FillStepResult {
  filledCount: number;
  errors: string[];
}

export interface BaseAdaptor {
  name: string;
  isMatched(): boolean;
  autofillCurrentStep(profile: CandidateProfile): Promise<FillStepResult>;
}
